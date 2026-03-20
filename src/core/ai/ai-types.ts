export type GenerationMode = 'full-song' | 'instrumental' | 'stem' | 'continuation' | 'variation';

export type StemType = 'drums' | 'bass' | 'melody' | 'vocals' | 'harmony' | 'other';

export interface GenerationRequest {
  mode: GenerationMode;
  prompt: string;
  lyrics?: string;
  duration?: number;       // seconds, default 30
  tempo?: number;          // BPM, inherited from project
  key?: string;            // musical key, inherited from project
  stemType?: StemType;     // for stem mode
  referenceTrackId?: string; // for continuation/variation
}

export interface GenerationResult {
  id: string;
  audioUrl: string;
  stems?: StemResult[];
  midiData?: string;       // base64 MIDI if available
  duration: number;
  prompt: string;
  mode: GenerationMode;
  createdAt: number;
}

export interface StemResult {
  type: StemType;
  audioUrl: string;
}

export type GenerationStatus = 'idle' | 'generating' | 'processing' | 'complete' | 'error';

export interface ReplicatePrediction {
  id: string;
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';
  output: string | string[] | null;
  error: string | null;
  urls: { get: string; cancel: string };
}

export const GENERATION_MODE_LABELS: Record<GenerationMode, string> = {
  'full-song': 'Full Song',
  instrumental: 'Instrumental',
  stem: 'Single Stem',
  continuation: 'Continue Track',
  variation: 'Variation',
};

export const STEM_TYPE_LABELS: Record<StemType, string> = {
  drums: 'Drums',
  bass: 'Bass',
  melody: 'Melody',
  vocals: 'Vocals',
  harmony: 'Harmony',
  other: 'Other',
};

// Replicate model versions for each use case
export const REPLICATE_MODELS = {
  musicgen: 'meta/musicgen:671ac645ce5e552cc63a54a2bbff63fcf798043055d2dac5fc9e36a837eedbb',
  stableAudio: 'stability-ai/stable-audio-open-1.0',
  demucs: 'cjwbw/demucs:25a173108cff36ef9f80f854c162d01df9e6528be175794b81571f6740379d68',
} as const;

export const MAX_DURATION: Record<string, number> = {
  free: 15,
  pro: 120,
  studio: 300,
};
