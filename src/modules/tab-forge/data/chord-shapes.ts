export interface ChordShape {
  name: string;
  frets: (number | null)[]; // high e to low E
  category: 'open' | 'barre' | 'power';
}

export const CHORD_SHAPES: ChordShape[] = [
  // Open chords
  { name: 'C', frets: [0, 1, 0, 2, 3, null], category: 'open' },
  { name: 'D', frets: [2, 3, 2, 0, null, null], category: 'open' },
  { name: 'E', frets: [0, 0, 1, 2, 2, 0], category: 'open' },
  { name: 'F', frets: [1, 1, 2, 3, 3, 1], category: 'barre' },
  { name: 'G', frets: [3, 0, 0, 0, 2, 3], category: 'open' },
  { name: 'A', frets: [0, 2, 2, 2, 0, null], category: 'open' },
  { name: 'B', frets: [2, 4, 4, 4, 2, null], category: 'barre' },

  // Minor open chords
  { name: 'Am', frets: [0, 1, 2, 2, 0, null], category: 'open' },
  { name: 'Dm', frets: [1, 3, 2, 0, null, null], category: 'open' },
  { name: 'Em', frets: [0, 0, 0, 2, 2, 0], category: 'open' },
  { name: 'Fm', frets: [1, 1, 1, 3, 3, 1], category: 'barre' },
  { name: 'Bm', frets: [2, 3, 4, 4, 2, null], category: 'barre' },

  // 7th chords
  { name: 'A7', frets: [0, 2, 0, 2, 0, null], category: 'open' },
  { name: 'B7', frets: [2, 0, 2, 1, 2, null], category: 'open' },
  { name: 'C7', frets: [0, 1, 3, 2, 3, null], category: 'open' },
  { name: 'D7', frets: [1, 3, 2, 0, null, null], category: 'open' },
  { name: 'E7', frets: [0, 0, 1, 0, 2, 0], category: 'open' },
  { name: 'G7', frets: [1, 0, 0, 0, 2, 3], category: 'open' },

  // Major 7th
  { name: 'Cmaj7', frets: [0, 0, 0, 2, 3, null], category: 'open' },
  { name: 'Fmaj7', frets: [0, 1, 2, 3, null, null], category: 'open' },
  { name: 'Gmaj7', frets: [2, 0, 0, 0, 2, 3], category: 'open' },

  // Minor 7th
  { name: 'Am7', frets: [0, 1, 0, 2, 0, null], category: 'open' },
  { name: 'Dm7', frets: [1, 1, 2, 0, null, null], category: 'open' },
  { name: 'Em7', frets: [0, 0, 0, 0, 2, 0], category: 'open' },

  // Power chords
  { name: 'E5', frets: [null, null, null, 2, 2, 0], category: 'power' },
  { name: 'A5', frets: [null, null, null, 2, 0, null], category: 'power' },
  { name: 'D5', frets: [null, null, null, 0, null, null], category: 'power' },
  { name: 'G5', frets: [null, null, 0, 0, null, 3], category: 'power' },

  // Suspended
  { name: 'Dsus2', frets: [0, 3, 2, 0, null, null], category: 'open' },
  { name: 'Dsus4', frets: [3, 3, 2, 0, null, null], category: 'open' },
  { name: 'Asus2', frets: [0, 2, 2, 0, 0, null], category: 'open' },
  { name: 'Asus4', frets: [0, 2, 2, 3, 0, null], category: 'open' },
];
