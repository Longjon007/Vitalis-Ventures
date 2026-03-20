import * as Tone from 'tone';
import { Project } from '../types/project';
import { ticksToSeconds } from '../utils/timing-utils';
import { EffectConfig, TrackEffectsChain } from './effects-chain';
import { getCachedSampler, loadSampler, disposeAllSamplers } from './sampler-engine';
import { Metronome } from './metronome';
import type { InstrumentType } from '../types/instrument';

type PositionCallback = (tick: number) => void;

let synths: Map<string, Tone.PolySynth> = new Map();
let samplerTracks: Set<string> = new Set(); // tracks using samplers instead of synths
let players: Map<string, Tone.Player> = new Map();
let effectsChains: Map<string, TrackEffectsChain> = new Map();
let scheduledEvents: number[] = [];
let animFrameId: number | null = null;
let positionCallback: PositionCallback | null = null;
let useSamplers = true;

function getSynthForTrack(trackId: string, type: string): Tone.PolySynth | Tone.Sampler {
  if (synths.has(trackId)) return synths.get(trackId)!;

  // Try cached sampler first for supported instruments
  if (useSamplers) {
    const sampler = getCachedSampler(type as InstrumentType);
    if (sampler) {
      samplerTracks.add(trackId);
      // Wrap sampler in synths map for effects chain compatibility
      // Sampler shares the Tone.Sampler instance across tracks of same type
      return sampler;
    }
  }

  // Don't connect to destination yet — effects chain will handle routing
  const synth = new Tone.PolySynth(Tone.Synth);

  switch (type) {
    case 'piano':
      synth.set({ oscillator: { type: 'triangle' }, envelope: { attack: 0.01, decay: 0.3, sustain: 0.3, release: 0.8 } });
      break;
    case 'guitar':
      synth.set({ oscillator: { type: 'sawtooth' }, envelope: { attack: 0.005, decay: 0.2, sustain: 0.1, release: 0.5 } });
      break;
    case 'bass':
      synth.set({ oscillator: { type: 'sine' }, envelope: { attack: 0.01, decay: 0.1, sustain: 0.6, release: 0.3 } });
      break;
    case 'strings':
      synth.set({ oscillator: { type: 'sawtooth' }, envelope: { attack: 0.3, decay: 0.1, sustain: 0.8, release: 1.0 } });
      break;
    case 'pad':
      synth.set({ oscillator: { type: 'sine' }, envelope: { attack: 0.5, decay: 0.2, sustain: 0.7, release: 1.5 } });
      break;
    case 'drums':
      synth.set({ oscillator: { type: 'triangle' }, envelope: { attack: 0.001, decay: 0.15, sustain: 0, release: 0.1 } });
      break;
    default:
      synth.set({ oscillator: { type: 'square' }, envelope: { attack: 0.01, decay: 0.2, sustain: 0.4, release: 0.5 } });
  }

  // Default: route directly to destination (effects chain will re-route if effects are applied)
  synth.toDestination();

  synths.set(trackId, synth);
  return synth;
}

function midiToNote(midi: number): string {
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const octave = Math.floor(midi / 12) - 1;
  return `${names[midi % 12]}${octave}`;
}

export const AudioEngine = {
  async init() {
    await Tone.start();
  },

  setLoop(startTick: number, endTick: number, bpm: number) {
    const transport = Tone.getTransport();
    transport.loop = true;
    transport.loopStart = ticksToSeconds(startTick, bpm);
    transport.loopEnd = ticksToSeconds(endTick, bpm);
  },

  clearLoop() {
    Tone.getTransport().loop = false;
  },

  async preloadSamplers(project: Project) {
    if (!useSamplers) return;
    const types = new Set(project.tracks.map((t) => t.instrument.type));
    const promises: Promise<unknown>[] = [];
    for (const type of types) {
      if (type === 'piano' || type === 'strings') {
        promises.push(loadSampler(type));
      }
    }
    await Promise.allSettled(promises);
  },

  scheduleProject(project: Project) {
    this.clearSchedule();
    Tone.getTransport().bpm.value = project.tempo;

    const hasSolo = project.tracks.some((t) => t.solo);

    for (const track of project.tracks) {
      if (track.muted) continue;
      if (hasSolo && !track.solo) continue;

      // Audio tracks (AI-generated) use Tone.Player
      if (track.audioUrl) {
        const existingPlayer = players.get(track.id);
        if (existingPlayer) {
          existingPlayer.dispose();
          players.delete(track.id);
        }
        try {
          const player = new Tone.Player({
            url: track.audioUrl,
            volume: Tone.gainToDb(track.volume),
          }).toDestination();
          player.sync().start(0);
          players.set(track.id, player);
        } catch {
          // Audio URL may be expired/unavailable — skip
        }
        continue;
      }

      const instrument = getSynthForTrack(track.id, track.instrument.type);
      instrument.volume.value = Tone.gainToDb(track.volume);

      // Ensure instrument is routed to destination if not using effects
      if (!effectsChains.has(track.id) && !samplerTracks.has(track.id)) {
        // PolySynth — already routed in getSynthForTrack
      } else if (samplerTracks.has(track.id)) {
        instrument.toDestination();
      }

      for (const note of track.notes) {
        const startTime = ticksToSeconds(note.startTick, project.tempo);
        const duration = ticksToSeconds(note.durationTicks, project.tempo);
        const velocity = note.velocity / 127;

        const eventId = Tone.getTransport().schedule((time) => {
          instrument.triggerAttackRelease(
            midiToNote(note.pitch),
            duration,
            time,
            velocity
          );
        }, startTime);
        scheduledEvents.push(eventId);
      }
    }
  },

  clearSchedule() {
    for (const id of scheduledEvents) {
      Tone.getTransport().clear(id);
    }
    scheduledEvents = [];
  },

  /** Apply effects chain to a track's synth */
  setTrackEffects(trackId: string, configs: EffectConfig[]) {
    const synth = synths.get(trackId);
    if (!synth) return;

    // Dispose old chain
    const oldChain = effectsChains.get(trackId);
    if (oldChain) oldChain.dispose();

    // Create new chain
    const chain = new TrackEffectsChain(synth);
    for (const config of configs) {
      chain.addEffect(config);
    }
    effectsChains.set(trackId, chain);
  },

  clearTrackEffects(trackId: string) {
    const chain = effectsChains.get(trackId);
    if (chain) {
      chain.dispose();
      effectsChains.delete(trackId);
      // Re-route synth to destination
      const synth = synths.get(trackId);
      if (synth) {
        try { synth.disconnect(); } catch { /* ok */ }
        synth.toDestination();
      }
    }
  },

  play() {
    Tone.getTransport().start();
    this.startPositionTracking();
  },

  pause() {
    Tone.getTransport().pause();
    this.stopPositionTracking();
  },

  stop() {
    Tone.getTransport().stop();
    Tone.getTransport().position = 0;
    Metronome.stop();
    this.stopPositionTracking();
  },

  seekTo(seconds: number) {
    Tone.getTransport().seconds = seconds;
  },

  setTempo(bpm: number) {
    Tone.getTransport().bpm.value = bpm;
  },

  onPosition(callback: PositionCallback) {
    positionCallback = callback;
  },

  startPositionTracking() {
    const tick = () => {
      if (positionCallback) {
        const seconds = Tone.getTransport().seconds;
        const bpm = Tone.getTransport().bpm.value;
        const ticksPerSecond = (bpm / 60) * 480;
        positionCallback(Math.round(seconds * ticksPerSecond));
      }
      animFrameId = requestAnimationFrame(tick);
    };
    tick();
  },

  stopPositionTracking() {
    if (animFrameId !== null) {
      cancelAnimationFrame(animFrameId);
      animFrameId = null;
    }
  },

  dispose() {
    this.stop();
    this.clearSchedule();
    Metronome.dispose();
    for (const chain of effectsChains.values()) {
      chain.dispose();
    }
    effectsChains.clear();
    for (const synth of synths.values()) {
      synth.dispose();
    }
    synths.clear();
    samplerTracks.clear();
    disposeAllSamplers();
    for (const player of players.values()) {
      player.dispose();
    }
    players.clear();
  },
};
