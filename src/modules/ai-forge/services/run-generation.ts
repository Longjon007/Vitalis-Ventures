import { env, hasRunGenerationConfig } from '../../../core/config/env';
import { getSupabase } from '../../../core/supabase/client';
import { getErrorMessage } from '../../../core/utils/errors';

export interface RunGenerationRequest {
  generationId: string;
  prompt: string;
  mode: string;
  genre: string;
  bpm: number;
  keySignature: string;
  duration: number;
}

export interface RunGenerationResponse {
  success: boolean;
  status?: string;
  outputUrl?: string;
  previewUrl?: string;
  error?: string;
}

function normalizeString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const supabase = getSupabase();
  if (!supabase) return headers;

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session?.access_token) {
      headers.Authorization = `Bearer ${session.access_token}`;
    }
  } catch {
    // Ignore auth header failures; backend will enforce auth.
  }

  return headers;
}

export async function runGeneration(
  payload: RunGenerationRequest,
): Promise<RunGenerationResponse> {
  if (!hasRunGenerationConfig() || !env.runGenerationEndpoint) {
    throw new Error('Generation backend endpoint is not configured.');
  }

  const response = await fetch(env.runGenerationEndpoint, {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify(payload),
  });

  const parsed = (await response.json().catch(() => null)) as
    | Record<string, unknown>
    | null;

  if (!response.ok) {
    const detail = parsed ? normalizeString(parsed.error) : null;
    throw new Error(detail ?? `Generation request failed (${response.status}).`);
  }

  return {
    success: parsed?.success === true,
    status: normalizeString(parsed?.status) ?? undefined,
    outputUrl: normalizeString(parsed?.outputUrl) ?? undefined,
    previewUrl: normalizeString(parsed?.previewUrl) ?? undefined,
    error: normalizeString(parsed?.error) ?? undefined,
  };
}

export function normalizeRunGenerationError(error: unknown): string {
  return getErrorMessage(error, 'Failed to run generation.');
}
