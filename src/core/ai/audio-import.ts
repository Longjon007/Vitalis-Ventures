import { v4 as uuid } from 'uuid';
import { Track } from '../types/project';
import { INSTRUMENTS } from '../types/instrument';
import { StemType, GenerationResult } from './ai-types';

const STEM_TO_INSTRUMENT: Record<StemType, keyof typeof INSTRUMENTS> = {
  drums: 'drums',
  bass: 'bass',
  melody: 'piano',
  vocals: 'synth',
  harmony: 'pad',
  other: 'synth',
};

/**
 * Fetch an audio URL and decode it into an AudioBuffer.
 */
export async function audioUrlToBuffer(url: string): Promise<AudioBuffer> {
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  const ctx = new AudioContext();
  const buffer = await ctx.decodeAudioData(arrayBuffer);
  ctx.close();
  return buffer;
}

/**
 * Create a Track from an AI generation result.
 * The track stores the audioUrl for playback via Tone.Player.
 */
export function resultToTrack(
  audioUrl: string,
  name: string,
  instrumentType: keyof typeof INSTRUMENTS = 'synth'
): Track {
  return {
    id: uuid(),
    name,
    instrument: INSTRUMENTS[instrumentType],
    notes: [], // Audio tracks don't use MIDI notes
    volume: 0.8,
    pan: 0,
    muted: false,
    solo: false,
    audioUrl,
  };
}

/**
 * Import a full generation result into tracks.
 * If stems are available, creates one track per stem.
 * Otherwise creates a single track from the main audio.
 */
export function resultToTracks(result: GenerationResult): Track[] {
  if (result.stems && result.stems.length > 0) {
    return result.stems.map((stem) =>
      resultToTrack(
        stem.audioUrl,
        `AI ${stem.type.charAt(0).toUpperCase() + stem.type.slice(1)}`,
        STEM_TO_INSTRUMENT[stem.type]
      )
    );
  }

  return [resultToTrack(result.audioUrl, `AI: ${result.prompt.slice(0, 30)}`)];
}

/**
 * Get the duration of an audio URL in seconds.
 */
export async function getAudioDuration(url: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const audio = new Audio();
    audio.addEventListener('loadedmetadata', () => {
      resolve(audio.duration);
    });
    audio.addEventListener('error', () => {
      reject(new Error('Failed to load audio'));
    });
    audio.src = url;
  });
}
