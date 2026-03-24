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
 * Import audio from an external URL via the audio-proxy Edge Function.
 * Handles Suno, Udio share links and direct audio file URLs.
 */
export async function importAudioFromUrl(url: string, accessToken: string): Promise<Track> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  if (!supabaseUrl) {
    throw new Error('Supabase is not configured.');
  }

  const response = await fetch(`${supabaseUrl.replace(/\/+$/, '')}/functions/v1/audio-proxy`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ url }),
  });

  if (!response.ok) {
    let detail = 'Failed to import audio from URL.';
    try {
      const err = await response.json();
      if (err && typeof err === 'object' && typeof (err as Record<string, unknown>).error === 'string') {
        detail = (err as Record<string, unknown>).error as string;
      }
    } catch {
      // ignore parse errors
    }
    throw new Error(detail);
  }

  const blob = await response.blob();
  const audioUrl = URL.createObjectURL(blob);

  // Extract a name from the URL
  let name = 'Imported Track';
  try {
    const pathname = new URL(url).pathname;
    const lastSegment = pathname.split('/').filter(Boolean).pop() || '';
    const cleaned = lastSegment.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
    if (cleaned.length > 2) {
      name = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    }
  } catch {
    // keep default name
  }

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
