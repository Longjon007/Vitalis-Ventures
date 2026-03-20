import { v4 as uuid } from 'uuid';
import { Track } from '../types/project';
import { INSTRUMENTS } from '../types/instrument';

/**
 * Import an audio file (WAV, MP3, OGG) as a MusicForge audio track.
 */
export async function importAudioFile(file: File): Promise<Track> {
  // Validate that the browser can decode this audio
  const arrayBuffer = await file.arrayBuffer();
  const audioCtx = new AudioContext();
  try {
    await audioCtx.decodeAudioData(arrayBuffer.slice(0));
  } finally {
    await audioCtx.close();
  }

  // Create a blob URL for playback
  const blob = new Blob([arrayBuffer], { type: file.type });
  const audioUrl = URL.createObjectURL(blob);

  const name = file.name.replace(/\.[^.]+$/, '') || 'Audio Track';

  return {
    id: uuid(),
    name,
    instrument: INSTRUMENTS.synth,
    notes: [],
    volume: 0.8,
    pan: 0,
    muted: false,
    solo: false,
    audioUrl,
  };
}

/**
 * Check if a file is a supported audio format.
 */
export function isAudioFile(file: File): boolean {
  const ext = file.name.toLowerCase();
  return ext.endsWith('.wav') || ext.endsWith('.mp3') || ext.endsWith('.ogg') || ext.endsWith('.webm');
}

/**
 * Check if a file is a MIDI file.
 */
export function isMidiFile(file: File): boolean {
  const ext = file.name.toLowerCase();
  return ext.endsWith('.mid') || ext.endsWith('.midi');
}
