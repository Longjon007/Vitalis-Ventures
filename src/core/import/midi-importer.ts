import { Midi } from '@tonejs/midi';
import { v4 as uuid } from 'uuid';
import { Track, NoteEvent } from '../types/project';
import { InstrumentDefinition, INSTRUMENTS } from '../types/instrument';
import { TICKS_PER_BEAT } from '../types/music';

/**
 * Import a MIDI file and convert it to MusicForge tracks.
 */
export async function importMidiFile(file: File): Promise<{
  tracks: Track[];
  tempo: number;
  timeSignature: [number, number];
}> {
  const buffer = await file.arrayBuffer();
  const midi = new Midi(buffer);

  const tempo = midi.header.tempos.length > 0
    ? Math.round(midi.header.tempos[0].bpm)
    : 120;

  const timeSig = midi.header.timeSignatures.length > 0
    ? midi.header.timeSignatures[0]
    : null;
  const timeSignature: [number, number] = timeSig
    ? [timeSig.timeSignature[0], timeSig.timeSignature[1]]
    : [4, 4];

  // MIDI file PPQ (pulses per quarter note)
  const ppq = midi.header.ppq;
  const tickScale = TICKS_PER_BEAT / ppq;

  const tracks: Track[] = [];

  for (const midiTrack of midi.tracks) {
    if (midiTrack.notes.length === 0) continue;

    const instrument = guessInstrument(midiTrack.name, midiTrack.channel);

    const notes: NoteEvent[] = midiTrack.notes.map((note) => ({
      id: uuid(),
      pitch: note.midi,
      startTick: Math.round(note.ticks * tickScale),
      durationTicks: Math.max(1, Math.round(note.durationTicks * tickScale)),
      velocity: Math.round(note.velocity * 127),
    }));

    tracks.push({
      id: uuid(),
      name: midiTrack.name || `Track ${tracks.length + 1}`,
      instrument,
      notes,
      volume: 0.8,
      pan: 0,
      muted: false,
      solo: false,
    });
  }

  return { tracks, tempo, timeSignature };
}

function guessInstrument(name: string, channel: number): InstrumentDefinition {
  const lower = name.toLowerCase();

  // MIDI channel 10 (index 9) is typically drums
  if (channel === 9) return INSTRUMENTS.drums;

  if (lower.includes('piano') || lower.includes('keys')) return INSTRUMENTS.piano;
  if (lower.includes('guitar')) return INSTRUMENTS.guitar;
  if (lower.includes('bass')) return INSTRUMENTS.bass;
  if (lower.includes('drum') || lower.includes('perc')) return INSTRUMENTS.drums;
  if (lower.includes('string') || lower.includes('violin') || lower.includes('cello')) return INSTRUMENTS.strings;
  if (lower.includes('pad') || lower.includes('synth pad')) return INSTRUMENTS.pad;
  if (lower.includes('synth') || lower.includes('lead')) return INSTRUMENTS.synth;

  return INSTRUMENTS.piano;
}
