export type TimeSignature = [number, number]; // [beats, beatValue]

export type NoteDuration = 'whole' | 'half' | 'quarter' | 'eighth' | 'sixteenth';

export const NOTE_DURATION_TICKS: Record<NoteDuration, number> = {
  whole: 1920,
  half: 960,
  quarter: 480,
  eighth: 240,
  sixteenth: 120,
};

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

export const TICKS_PER_BEAT = 480;
