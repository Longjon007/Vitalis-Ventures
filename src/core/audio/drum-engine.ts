import * as Tone from 'tone';

export type DrumSound = 'kick' | 'snare' | 'hihat' | 'openhat' | 'clap' | 'tom1' | 'tom2' | 'crash' | 'ride';

export interface DrumPattern {
  id: string;
  name: string;
  steps: number;
  bpm: number;
  swing: number; // 0-100, 0 = no swing
  tracks: DrumTrack[];
}

export interface DrumTrack {
  sound: DrumSound;
  pattern: number[]; // 0 = off, 1-127 = velocity
  volume: number;
  muted: boolean;
}

const drumSynths: Map<DrumSound, Tone.MembraneSynth | Tone.NoiseSynth | Tone.MetalSynth> = new Map();

function createMetalSynth(opts: {
  freq: number;
  envelope: Partial<Tone.EnvelopeOptions>;
  harmonicity: number;
  modulationIndex: number;
  resonance: number;
  octaves: number;
  volumeDb?: number;
}): Tone.MetalSynth {
  const synth = new Tone.MetalSynth({
    envelope: opts.envelope as Tone.EnvelopeOptions,
    harmonicity: opts.harmonicity,
    modulationIndex: opts.modulationIndex,
    resonance: opts.resonance,
    octaves: opts.octaves,
  }).toDestination();
  synth.frequency.value = opts.freq;
  if (opts.volumeDb !== undefined) synth.volume.value = opts.volumeDb;
  return synth;
}

function getDrumSynth(sound: DrumSound): Tone.MembraneSynth | Tone.NoiseSynth | Tone.MetalSynth {
  if (drumSynths.has(sound)) return drumSynths.get(sound)!;

  let synth: Tone.MembraneSynth | Tone.NoiseSynth | Tone.MetalSynth;

  switch (sound) {
    case 'kick':
      synth = new Tone.MembraneSynth({
        pitchDecay: 0.05,
        octaves: 6,
        oscillator: { type: 'sine' },
        envelope: { attack: 0.001, decay: 0.3, sustain: 0, release: 0.1 },
      }).toDestination();
      break;
    case 'snare':
      synth = new Tone.NoiseSynth({
        noise: { type: 'white' },
        envelope: { attack: 0.001, decay: 0.15, sustain: 0, release: 0.05 },
      }).toDestination();
      break;
    case 'hihat':
      synth = createMetalSynth({
        freq: 400,
        envelope: { attack: 0.001, decay: 0.05, release: 0.01 },
        harmonicity: 5.1,
        modulationIndex: 32,
        resonance: 4000,
        octaves: 1.5,
        volumeDb: -10,
      });
      break;
    case 'openhat':
      synth = createMetalSynth({
        freq: 400,
        envelope: { attack: 0.001, decay: 0.3, release: 0.1 },
        harmonicity: 5.1,
        modulationIndex: 32,
        resonance: 4000,
        octaves: 1.5,
        volumeDb: -10,
      });
      break;
    case 'clap':
      synth = new Tone.NoiseSynth({
        noise: { type: 'pink' },
        envelope: { attack: 0.005, decay: 0.1, sustain: 0, release: 0.05 },
      }).toDestination();
      break;
    case 'tom1':
      synth = new Tone.MembraneSynth({
        pitchDecay: 0.08,
        octaves: 4,
        oscillator: { type: 'sine' },
        envelope: { attack: 0.001, decay: 0.2, sustain: 0, release: 0.1 },
      }).toDestination();
      break;
    case 'tom2':
      synth = new Tone.MembraneSynth({
        pitchDecay: 0.08,
        octaves: 3,
        oscillator: { type: 'sine' },
        envelope: { attack: 0.001, decay: 0.25, sustain: 0, release: 0.1 },
      }).toDestination();
      break;
    case 'crash':
      synth = createMetalSynth({
        freq: 300,
        envelope: { attack: 0.001, decay: 1.0, release: 0.3 },
        harmonicity: 5.1,
        modulationIndex: 40,
        resonance: 3500,
        octaves: 1.5,
        volumeDb: -8,
      });
      break;
    case 'ride':
      synth = createMetalSynth({
        freq: 500,
        envelope: { attack: 0.001, decay: 0.4, release: 0.2 },
        harmonicity: 5.1,
        modulationIndex: 20,
        resonance: 5000,
        octaves: 1.0,
        volumeDb: -12,
      });
      break;
  }

  drumSynths.set(sound, synth);
  return synth;
}

const DRUM_NOTES: Record<DrumSound, string> = {
  kick: 'C1',
  snare: 'D1',
  hihat: 'F#1',
  openhat: 'A#1',
  clap: 'D#1',
  tom1: 'A1',
  tom2: 'G1',
  crash: 'C#2',
  ride: 'D#2',
};

function triggerDrum(synth: Tone.MembraneSynth | Tone.NoiseSynth | Tone.MetalSynth, sound: DrumSound, time?: Tone.Unit.Time, velocity: number = 100) {
  const t = time ?? Tone.now();
  const vel = velocity / 127;
  if (synth instanceof Tone.NoiseSynth) {
    synth.triggerAttackRelease('16n', t);
  } else if (synth instanceof Tone.MetalSynth) {
    synth.triggerAttackRelease('16n', t, vel);
  } else {
    synth.triggerAttackRelease(DRUM_NOTES[sound], '16n', t, vel);
  }
}

let scheduledIds: number[] = [];

export const DrumEngine = {
  schedulePattern(pattern: DrumPattern) {
    this.clearSchedule();
    const stepDuration = (60 / pattern.bpm) / 4;
    const swingAmount = (pattern.swing ?? 0) / 100;

    for (const track of pattern.tracks) {
      if (track.muted) continue;
      const synth = getDrumSynth(track.sound);
      synth.volume.value = Tone.gainToDb(track.volume);

      for (let step = 0; step < pattern.steps; step++) {
        const vel = track.pattern[step];
        if (!vel) continue;
        // Swing: delay odd-numbered 16th notes
        let time = step * stepDuration;
        if (step % 2 === 1 && swingAmount > 0) {
          time += stepDuration * swingAmount * 0.5;
        }
        const velocity = vel;
        const eventId = Tone.getTransport().schedule((t) => {
          triggerDrum(synth, track.sound, t, velocity);
        }, time);
        scheduledIds.push(eventId);
      }
    }
  },

  clearSchedule() {
    for (const id of scheduledIds) {
      Tone.getTransport().clear(id);
    }
    scheduledIds = [];
  },

  previewSound(sound: DrumSound) {
    const synth = getDrumSynth(sound);
    triggerDrum(synth, sound);
  },

  dispose() {
    this.clearSchedule();
    for (const synth of drumSynths.values()) {
      synth.dispose();
    }
    drumSynths.clear();
  },
};

export const ALL_DRUM_SOUNDS: DrumSound[] = [
  'kick', 'snare', 'hihat', 'openhat', 'clap', 'tom1', 'tom2', 'crash', 'ride',
];

export function createEmptyPattern(steps: number = 16, bpm: number = 120): DrumPattern {
  return {
    id: '',
    name: 'New Pattern',
    steps,
    bpm,
    swing: 0,
    tracks: ALL_DRUM_SOUNDS.map((sound) => ({
      sound,
      pattern: Array(steps).fill(0),
      volume: 0.7,
      muted: false,
    })),
  };
}

// GM drum map MIDI note numbers for exporting drum patterns to project tracks
export const DRUM_MIDI_MAP: Record<DrumSound, number> = {
  kick: 36,   // C2
  snare: 38,  // D2
  hihat: 42,  // F#2
  openhat: 46,// A#2
  clap: 39,   // D#2
  tom1: 48,   // C3
  tom2: 45,   // A2
  crash: 49,  // C#3
  ride: 51,   // D#3
};

export const PRESET_PATTERNS: Record<string, Partial<DrumPattern>> = {
  'basic-rock': {
    name: 'Basic Rock',
    tracks: [
      { sound: 'kick', pattern: [100,0,0,0,100,0,0,0,100,0,0,0,100,0,0,0], volume: 0.8, muted: false },
      { sound: 'snare', pattern: [0,0,0,0,100,0,0,0,0,0,0,0,100,0,0,0], volume: 0.7, muted: false },
      { sound: 'hihat', pattern: [80,0,60,0,80,0,60,0,80,0,60,0,80,0,60,0], volume: 0.5, muted: false },
    ],
  },
  'four-on-floor': {
    name: 'Four on the Floor',
    tracks: [
      { sound: 'kick', pattern: [110,0,0,0,110,0,0,0,110,0,0,0,110,0,0,0], volume: 0.8, muted: false },
      { sound: 'snare', pattern: [0,0,0,0,100,0,0,0,0,0,0,0,100,0,0,0], volume: 0.7, muted: false },
      { sound: 'hihat', pattern: [70,50,70,50,70,50,70,50,70,50,70,50,70,50,70,50], volume: 0.4, muted: false },
      { sound: 'openhat', pattern: [0,0,0,0,0,0,0,90,0,0,0,0,0,0,0,90], volume: 0.5, muted: false },
    ],
  },
  'hip-hop': {
    name: 'Hip Hop',
    tracks: [
      { sound: 'kick', pattern: [110,0,0,90,0,0,100,0,0,0,110,0,0,90,0,0], volume: 0.9, muted: false },
      { sound: 'snare', pattern: [0,0,0,0,100,0,0,0,0,0,0,0,100,0,0,0], volume: 0.7, muted: false },
      { sound: 'hihat', pattern: [80,60,0,70,80,0,60,80,70,80,0,60,80,0,70,0], volume: 0.4, muted: false },
    ],
  },
};
