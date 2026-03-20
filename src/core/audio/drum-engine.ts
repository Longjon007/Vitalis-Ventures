import * as Tone from 'tone';

export type DrumSound = 'kick' | 'snare' | 'hihat' | 'openhat' | 'clap' | 'tom1' | 'tom2' | 'crash' | 'ride';

export interface DrumPattern {
  id: string;
  name: string;
  steps: number;
  bpm: number;
  tracks: DrumTrack[];
}

export interface DrumTrack {
  sound: DrumSound;
  pattern: boolean[];
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

function triggerDrum(synth: Tone.MembraneSynth | Tone.NoiseSynth | Tone.MetalSynth, sound: DrumSound, time?: Tone.Unit.Time) {
  const t = time ?? Tone.now();
  if (synth instanceof Tone.NoiseSynth) {
    synth.triggerAttackRelease('16n', t);
  } else if (synth instanceof Tone.MetalSynth) {
    synth.triggerAttackRelease('16n', t, 0.8);
  } else {
    synth.triggerAttackRelease(DRUM_NOTES[sound], '16n', t);
  }
}

let scheduledIds: number[] = [];

export const DrumEngine = {
  schedulePattern(pattern: DrumPattern) {
    this.clearSchedule();
    const stepDuration = (60 / pattern.bpm) / 4;

    for (const track of pattern.tracks) {
      if (track.muted) continue;
      const synth = getDrumSynth(track.sound);
      synth.volume.value = Tone.gainToDb(track.volume);

      for (let step = 0; step < pattern.steps; step++) {
        if (!track.pattern[step]) continue;
        const time = step * stepDuration;
        const eventId = Tone.getTransport().schedule((t) => {
          triggerDrum(synth, track.sound, t);
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
    tracks: ALL_DRUM_SOUNDS.map((sound) => ({
      sound,
      pattern: Array(steps).fill(false),
      volume: 0.7,
      muted: false,
    })),
  };
}

export const PRESET_PATTERNS: Record<string, Partial<DrumPattern>> = {
  'basic-rock': {
    name: 'Basic Rock',
    tracks: [
      { sound: 'kick', pattern: [true,false,false,false,true,false,false,false,true,false,false,false,true,false,false,false], volume: 0.8, muted: false },
      { sound: 'snare', pattern: [false,false,false,false,true,false,false,false,false,false,false,false,true,false,false,false], volume: 0.7, muted: false },
      { sound: 'hihat', pattern: [true,false,true,false,true,false,true,false,true,false,true,false,true,false,true,false], volume: 0.5, muted: false },
    ],
  },
  'four-on-floor': {
    name: 'Four on the Floor',
    tracks: [
      { sound: 'kick', pattern: [true,false,false,false,true,false,false,false,true,false,false,false,true,false,false,false], volume: 0.8, muted: false },
      { sound: 'snare', pattern: [false,false,false,false,true,false,false,false,false,false,false,false,true,false,false,false], volume: 0.7, muted: false },
      { sound: 'hihat', pattern: [true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true], volume: 0.4, muted: false },
      { sound: 'openhat', pattern: [false,false,false,false,false,false,false,true,false,false,false,false,false,false,false,true], volume: 0.5, muted: false },
    ],
  },
  'hip-hop': {
    name: 'Hip Hop',
    tracks: [
      { sound: 'kick', pattern: [true,false,false,true,false,false,true,false,false,false,true,false,false,true,false,false], volume: 0.9, muted: false },
      { sound: 'snare', pattern: [false,false,false,false,true,false,false,false,false,false,false,false,true,false,false,false], volume: 0.7, muted: false },
      { sound: 'hihat', pattern: [true,true,false,true,true,false,true,true,true,true,false,true,true,false,true,false], volume: 0.4, muted: false },
    ],
  },
};
