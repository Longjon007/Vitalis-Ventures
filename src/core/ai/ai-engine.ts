import { v4 as uuid } from 'uuid';
import {
  GenerationRequest,
  GenerationResult,
  GenerationMode,
  REPLICATE_MODELS,
  StemResult,
  StemType,
} from './ai-types';
import { createPrediction, pollPrediction } from './replicate-client';

/**
 * Build the Replicate model input based on generation mode.
 */
function buildModelInput(request: GenerationRequest): {
  version: string;
  input: Record<string, unknown>;
} {
  const duration = request.duration ?? 30;

  switch (request.mode) {
    case 'full-song':
    case 'instrumental':
    case 'continuation':
    case 'variation': {
      // Use MusicGen for instrumental generation
      const prompt = request.mode === 'instrumental'
        ? `${request.prompt}, instrumental, no vocals`
        : request.prompt;

      return {
        version: REPLICATE_MODELS.musicgen,
        input: {
          prompt,
          duration: Math.min(duration, 30), // MusicGen max ~30s
          temperature: request.mode === 'variation' ? 1.1 : 1.0,
          top_k: 250,
          top_p: 0,
          output_format: 'wav',
          normalization_strategy: 'loudness',
        },
      };
    }

    case 'stem': {
      // For stem generation, generate full then separate
      const stemPrompt = buildStemPrompt(request.prompt, request.stemType ?? 'melody');
      return {
        version: REPLICATE_MODELS.musicgen,
        input: {
          prompt: stemPrompt,
          duration: Math.min(duration, 30),
          temperature: 1.0,
          top_k: 250,
          top_p: 0,
          output_format: 'wav',
          normalization_strategy: 'loudness',
        },
      };
    }
  }
}

function buildStemPrompt(basePrompt: string, stemType: StemType): string {
  const stemHints: Record<StemType, string> = {
    drums: 'drum beat, percussion only, no melody, no bass',
    bass: 'bass line only, deep bass, no melody, no drums',
    melody: 'melody line, lead instrument, no drums, no bass',
    vocals: 'vocal melody, singing, a cappella',
    harmony: 'chord progression, harmony pads, background',
    other: basePrompt,
  };
  return `${basePrompt}, ${stemHints[stemType]}`;
}

/**
 * Run stem separation on an audio URL using Demucs.
 */
async function separateStems(
  audioUrl: string,
  onStatus?: (status: string) => void
): Promise<StemResult[]> {
  const prediction = await createPrediction(REPLICATE_MODELS.demucs, {
    audio: audioUrl,
    stems: 'drums,bass,vocals,other',
  });

  const result = await pollPrediction(prediction.id, onStatus);
  const output = result.output as Record<string, string> | null;

  if (!output) return [];

  const stemMap: Record<string, StemType> = {
    drums: 'drums',
    bass: 'bass',
    vocals: 'vocals',
    other: 'melody',
  };

  return Object.entries(output)
    .filter(([, url]) => typeof url === 'string')
    .map(([key, url]) => ({
      type: stemMap[key] ?? 'other',
      audioUrl: url,
    }));
}

/**
 * Main generation entry point.
 */
export async function generate(
  request: GenerationRequest,
  options?: {
    onStatus?: (status: string) => void;
    abortSignal?: AbortSignal;
    separateStems?: boolean;
  }
): Promise<GenerationResult> {
  const { version, input } = buildModelInput(request);

  // Create prediction
  options?.onStatus?.('starting');
  const prediction = await createPrediction(version, input);

  // Poll until complete
  const result = await pollPrediction(prediction.id, options?.onStatus, options?.abortSignal);

  // Extract audio URL from output
  let audioUrl: string;
  if (typeof result.output === 'string') {
    audioUrl = result.output;
  } else if (Array.isArray(result.output) && result.output.length > 0) {
    audioUrl = result.output[0];
  } else {
    throw new Error('No audio output received from model');
  }

  const genResult: GenerationResult = {
    id: uuid(),
    audioUrl,
    duration: request.duration ?? 30,
    prompt: request.prompt,
    mode: request.mode,
    createdAt: Date.now(),
  };

  // Optionally separate stems
  if (options?.separateStems) {
    options?.onStatus?.('processing');
    try {
      genResult.stems = await separateStems(audioUrl, options?.onStatus);
    } catch {
      // Stem separation failed — still return the main audio
    }
  }

  return genResult;
}

/**
 * Get estimated cost for a generation (rough approximation).
 */
export function estimateCost(mode: GenerationMode, durationSeconds: number): string {
  // MusicGen: ~$0.02/run for 30s
  const baseCost = 0.02;
  const runs = Math.ceil(durationSeconds / 30);
  const stemCost = mode === 'full-song' ? 0.03 : 0; // Demucs cost
  const total = runs * baseCost + stemCost;
  return `~$${total.toFixed(2)}`;
}
