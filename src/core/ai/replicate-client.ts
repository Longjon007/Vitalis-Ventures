import { ReplicatePrediction } from './ai-types';
import { getApiConfig } from './api-config';

function getAuthHeaders(): Record<string, string> {
  const config = getApiConfig();
  if (config.mode === 'proxy' && config.sessionToken) {
    return {
      'Authorization': `Bearer ${config.sessionToken}`,
      'Content-Type': 'application/json',
    };
  }
  const key = config.apiKey || localStorage.getItem('replicate-api-key');
  if (!key) throw new Error('Replicate API key not configured. Add your key in ForgeAI settings.');
  return {
    'Authorization': `Bearer ${key}`,
    'Content-Type': 'application/json',
    'Prefer': 'respond-async',
  };
}

function getBaseUrl(): string {
  const config = getApiConfig();
  return config.mode === 'proxy' ? config.baseUrl : 'https://api.replicate.com/v1';
}

export async function createPrediction(
  modelVersion: string,
  input: Record<string, unknown>
): Promise<ReplicatePrediction> {
  const res = await fetch(`${getBaseUrl()}/predictions`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({
      version: modelVersion,
      input,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(`Replicate API error: ${err.detail || res.statusText}`);
  }

  return res.json();
}

export async function getPrediction(predictionId: string): Promise<ReplicatePrediction> {
  const res = await fetch(`${getBaseUrl()}/predictions/${predictionId}`, {
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    throw new Error(`Failed to get prediction: ${res.statusText}`);
  }

  return res.json();
}

export async function cancelPrediction(predictionId: string): Promise<void> {
  await fetch(`${getBaseUrl()}/predictions/${predictionId}/cancel`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
}

/**
 * Poll a prediction until it reaches a terminal state.
 * Uses exponential backoff: 1s, 2s, 4s, 8s, then stays at 8s.
 */
export async function pollPrediction(
  predictionId: string,
  onStatus?: (status: string) => void,
  abortSignal?: AbortSignal
): Promise<ReplicatePrediction> {
  let delay = 1000;
  const maxDelay = 8000;
  const maxAttempts = 120; // ~8 minutes max

  for (let i = 0; i < maxAttempts; i++) {
    if (abortSignal?.aborted) {
      await cancelPrediction(predictionId);
      throw new Error('Generation cancelled');
    }

    const prediction = await getPrediction(predictionId);
    onStatus?.(prediction.status);

    if (prediction.status === 'succeeded') return prediction;
    if (prediction.status === 'failed') throw new Error(prediction.error || 'Generation failed');
    if (prediction.status === 'canceled') throw new Error('Generation cancelled');

    await new Promise((resolve) => setTimeout(resolve, delay));
    delay = Math.min(delay * 2, maxDelay);
  }

  throw new Error('Generation timed out');
}

export function hasApiKey(): boolean {
  return !!localStorage.getItem('replicate-api-key');
}

export function setApiKey(key: string): void {
  localStorage.setItem('replicate-api-key', key);
}

export function clearApiKey(): void {
  localStorage.removeItem('replicate-api-key');
}
