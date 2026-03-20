import * as Tone from 'tone';
import { InstrumentType } from '../types/instrument';

// CDN-hosted sample URLs from Tone.js examples
const SAMPLE_URLS: Partial<Record<InstrumentType, Record<string, string>>> = {
  piano: {
    A1: 'https://tonejs.github.io/audio/salamander/A1.mp3',
    A2: 'https://tonejs.github.io/audio/salamander/A2.mp3',
    A3: 'https://tonejs.github.io/audio/salamander/A3.mp3',
    A4: 'https://tonejs.github.io/audio/salamander/A4.mp3',
    A5: 'https://tonejs.github.io/audio/salamander/A5.mp3',
    C2: 'https://tonejs.github.io/audio/salamander/C2.mp3',
    C3: 'https://tonejs.github.io/audio/salamander/C3.mp3',
    C4: 'https://tonejs.github.io/audio/salamander/C4.mp3',
    C5: 'https://tonejs.github.io/audio/salamander/C5.mp3',
    'D#2': 'https://tonejs.github.io/audio/salamander/Ds2.mp3',
    'D#3': 'https://tonejs.github.io/audio/salamander/Ds3.mp3',
    'D#4': 'https://tonejs.github.io/audio/salamander/Ds4.mp3',
    'F#2': 'https://tonejs.github.io/audio/salamander/Fs2.mp3',
    'F#3': 'https://tonejs.github.io/audio/salamander/Fs3.mp3',
    'F#4': 'https://tonejs.github.io/audio/salamander/Fs4.mp3',
  },
};

const samplerCache: Map<InstrumentType, Tone.Sampler> = new Map();
const loadingPromises: Map<InstrumentType, Promise<Tone.Sampler | null>> = new Map();

/**
 * Attempt to load a Tone.Sampler for the given instrument type.
 * Returns null if no samples are available for this type.
 * Caches loaded samplers for reuse.
 */
export async function loadSampler(type: InstrumentType): Promise<Tone.Sampler | null> {
  // Return cached
  if (samplerCache.has(type)) return samplerCache.get(type)!;

  // Return in-progress load
  if (loadingPromises.has(type)) return loadingPromises.get(type)!;

  const urls = SAMPLE_URLS[type];
  if (!urls) return null;

  const promise = new Promise<Tone.Sampler | null>((resolve) => {
    const sampler = new Tone.Sampler({
      urls,
      onload: () => {
        samplerCache.set(type, sampler);
        loadingPromises.delete(type);
        resolve(sampler);
      },
      onerror: () => {
        loadingPromises.delete(type);
        resolve(null);
      },
    });
  });

  loadingPromises.set(type, promise);
  return promise;
}

/**
 * Check if a sampler is already cached (loaded) for this type.
 */
export function hasCachedSampler(type: InstrumentType): boolean {
  return samplerCache.has(type);
}

/**
 * Get a cached sampler synchronously (returns undefined if not loaded).
 */
export function getCachedSampler(type: InstrumentType): Tone.Sampler | undefined {
  return samplerCache.get(type);
}

/**
 * Dispose all cached samplers.
 */
export function disposeAllSamplers() {
  for (const sampler of samplerCache.values()) {
    sampler.dispose();
  }
  samplerCache.clear();
}
