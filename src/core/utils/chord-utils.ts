import { NoteEvent } from '../types/project';
import { TabPosition } from '../types/tab';
import { fretToMidi } from './note-utils';
import { v4 as uuid } from 'uuid';

export function tabPositionToNotes(
  position: TabPosition,
  tuning: number[],
  velocity: number = 100
): NoteEvent[] {
  const notes: NoteEvent[] = [];
  // tuning is low to high [E2,A2,D3,G3,B3,E4]
  // position.strings is high to low [e,B,G,D,A,E]
  const reversedTuning = [...tuning].reverse();

  for (let i = 0; i < position.strings.length; i++) {
    const fret = position.strings[i];
    if (fret !== null && fret >= 0) {
      notes.push({
        id: uuid(),
        pitch: fretToMidi(reversedTuning[i], fret),
        startTick: position.tick,
        durationTicks: 480, // quarter note default
        velocity,
      });
    }
  }
  return notes;
}

export function notesToTabPosition(
  notes: NoteEvent[],
  tuning: number[],
  tick: number
): TabPosition {
  const strings: (number | null)[] = [null, null, null, null, null, null];
  const reversedTuning = [...tuning].reverse();

  for (const note of notes) {
    for (let i = 0; i < 6; i++) {
      const fret = note.pitch - reversedTuning[i];
      if (fret >= 0 && fret <= 24 && strings[i] === null) {
        strings[i] = fret;
        break;
      }
    }
  }

  return {
    id: uuid(),
    tick,
    strings,
    duration: 'quarter',
  };
}
