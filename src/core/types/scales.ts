export interface Scale {
  name: string;
  intervals: number[];
}

export const SCALES: Record<string, Scale> = {
  major: { name: 'Major', intervals: [0, 2, 4, 5, 7, 9, 11] },
  minor: { name: 'Natural Minor', intervals: [0, 2, 3, 5, 7, 8, 10] },
  harmonicMinor: { name: 'Harmonic Minor', intervals: [0, 2, 3, 5, 7, 8, 11] },
  melodicMinor: { name: 'Melodic Minor', intervals: [0, 2, 3, 5, 7, 9, 11] },
  dorian: { name: 'Dorian', intervals: [0, 2, 3, 5, 7, 9, 10] },
  mixolydian: { name: 'Mixolydian', intervals: [0, 2, 4, 5, 7, 9, 10] },
  pentatonicMajor: { name: 'Pentatonic Major', intervals: [0, 2, 4, 7, 9] },
  pentatonicMinor: { name: 'Pentatonic Minor', intervals: [0, 3, 5, 7, 10] },
  blues: { name: 'Blues', intervals: [0, 3, 5, 6, 7, 10] },
  chromatic: { name: 'Chromatic', intervals: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
};

const NOTE_TO_SEMITONE: Record<string, number> = {
  'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3,
  'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8,
  'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11,
};

export function getScaleNotes(root: string, scaleKey: string): Set<number> {
  // Parse root - could be "Am" (minor), "C" (major), etc.
  let rootNote = root;
  let detectedScale = scaleKey;

  if (root.endsWith('m') && root.length > 1) {
    rootNote = root.slice(0, -1);
    if (detectedScale === 'major') detectedScale = 'minor';
  }

  const rootSemitone = NOTE_TO_SEMITONE[rootNote] ?? 0;
  const scale = SCALES[detectedScale] ?? SCALES.major;

  const notes = new Set<number>();
  for (const interval of scale.intervals) {
    notes.add((rootSemitone + interval) % 12);
  }
  return notes;
}

export function isInScale(midiNote: number, scaleNotes: Set<number>): boolean {
  return scaleNotes.has(midiNote % 12);
}

export function getChordSuggestions(
  progression: string[],
  key: string
): string[] {
  const scaleNotes = getScaleNotes(key, 'major');
  const rootSemitone = NOTE_TO_SEMITONE[key.replace('m', '')] ?? 0;

  // Diatonic chords in the key
  const majorDiatonic = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'];
  const minorDiatonic = ['i', 'ii°', 'III', 'iv', 'v', 'VI', 'VII'];
  const isMinor = key.endsWith('m');

  const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const scale = SCALES[isMinor ? 'minor' : 'major'];

  const chords: string[] = [];
  for (let i = 0; i < scale.intervals.length; i++) {
    const chordRoot = NOTE_NAMES[(rootSemitone + scale.intervals[i]) % 12];
    const quality = isMinor ? minorDiatonic[i] : majorDiatonic[i];
    const isMinorChord = quality === quality.toLowerCase() && !quality.includes('°');
    chords.push(chordRoot + (isMinorChord ? 'm' : '') + (quality.includes('°') ? 'dim' : ''));
  }

  // Filter out chords already in progression
  const lastChord = progression[progression.length - 1];
  return chords.filter((c) => c !== lastChord);
}
