import { NOTE_NAMES } from '../types/music';

export function midiToNoteName(midi: number): string {
  const octave = Math.floor(midi / 12) - 1;
  const note = NOTE_NAMES[midi % 12];
  return `${note}${octave}`;
}

export function noteNameToMidi(name: string): number {
  const match = name.match(/^([A-G]#?)(-?\d+)$/);
  if (!match) return 60;
  const [, note, octStr] = match;
  const noteIndex = NOTE_NAMES.indexOf(note as typeof NOTE_NAMES[number]);
  if (noteIndex === -1) return 60;
  return (parseInt(octStr) + 1) * 12 + noteIndex;
}

export function midiToFrequency(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function fretToMidi(stringTuning: number, fret: number): number {
  return stringTuning + fret;
}

export function midiToFret(stringTuning: number, midi: number): number | null {
  const fret = midi - stringTuning;
  if (fret < 0 || fret > 24) return null;
  return fret;
}

export function isBlackKey(midi: number): boolean {
  const note = midi % 12;
  return [1, 3, 6, 8, 10].includes(note);
}
