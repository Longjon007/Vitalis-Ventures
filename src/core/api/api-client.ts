import { getSupabase } from '../supabase/client';
import { trackEvent } from '../analytics/tracker';
import { getErrorMessage } from '../utils/errors';

export type ApiGenerateRequest = {
  prompt: string;
  mode?: 'standard' | 'variation' | 'extend' | 'remix';
  genre?: string;
  bpm?: number;
  keySignature?: string;
  duration?: number;
};

export type ApiGenerateResponse = {
  success: boolean;
  generationId?: string;
  status?: string;
  outputUrl?: string;
  previewUrl?: string;
  requestId?: string;
  error?: string;
};

export type ApiKeyRecord = {
  id: string;
  keyPrefix: string;
  label: string | null;
  isActive: boolean;
  createdAt: string;
  lastUsedAt: string | null;
};

export type CreateApiKeyResult = {
  success: boolean;
  id: string | null;
  key: string | null;
  prefix: string | null;
  error: string | null;
};

function readEnv(name: string): string | null {
  const value = import.meta.env[name] as string | undefined;
  if (!value) return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

export function getApiGenerateEndpoint(): string | null {
  const explicit = readEnv('VITE_PUBLIC_API_GENERATE_ENDPOINT');
  if (explicit) return explicit;

  const supabaseUrl = readEnv('VITE_SUPABASE_URL');
  if (!supabaseUrl) return null;

  return `${supabaseUrl.replace(/\/+$/, '')}/functions/v1/api-generate`;
}

function normalizeString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized || null;
}

function normalizeApiKeyRow(row: unknown): ApiKeyRecord | null {
  if (!row || typeof row !== 'object') return null;
  const item = row as Record<string, unknown>;

  if (typeof item.id !== 'string') return null;
  if (typeof item.key_prefix !== 'string') return null;
  if (typeof item.created_at !== 'string') return null;

  return {
    id: item.id,
    keyPrefix: item.key_prefix,
    label: typeof item.label === 'string' ? item.label : null,
    isActive: item.is_active === true,
    createdAt: item.created_at,
    lastUsedAt: typeof item.last_used_at === 'string' ? item.last_used_at : null,
  };
}

function normalizeRpcResult(value: unknown): Record<string, unknown> {
  if (Array.isArray(value)) {
    if (value.length === 0) return {};
    const first = value[0];
    if (first && typeof first === 'object' && !Array.isArray(first)) {
      return first as Record<string, unknown>;
    }
    return {};
  }

  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

export async function createApiKey(label?: string): Promise<CreateApiKeyResult> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase not configured.');

  try {
    const { data, error } = await supabase.rpc('create_api_key', {
      p_label: normalizeString(label),
    });
    if (error) {
      throw new Error(getErrorMessage(error, 'Failed to create API key.'));
    }

    const payload = normalizeRpcResult(data);
    return {
      success: payload.success === true,
      id: normalizeString(payload.id),
      key: normalizeString(payload.key),
      prefix: normalizeString(payload.prefix),
      error: normalizeString(payload.error),
    };
  } catch (err) {
    throw new Error(getErrorMessage(err, 'Failed to create API key.'));
  }
}

export async function listApiKeys(): Promise<ApiKeyRecord[]> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase not configured.');

  try {
    const { data, error } = await supabase
      .from('api_keys')
      .select('id, key_prefix, label, is_active, created_at, last_used_at')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(getErrorMessage(error, 'Failed to load API keys.'));
    }

    return (Array.isArray(data) ? data : [])
      .map(normalizeApiKeyRow)
      .filter((item): item is ApiKeyRecord => item !== null);
  } catch (err) {
    throw new Error(getErrorMessage(err, 'Failed to load API keys.'));
  }
}

export async function revokeApiKey(apiKeyId: string): Promise<void> {
  const id = apiKeyId.trim();
  if (!id) throw new Error('API key id is required.');

  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase not configured.');

  try {
    const { error } = await supabase
      .from('api_keys')
      .update({ is_active: false })
      .eq('id', id);

    if (error) {
      throw new Error(getErrorMessage(error, 'Failed to revoke API key.'));
    }
  } catch (err) {
    throw new Error(getErrorMessage(err, 'Failed to revoke API key.'));
  }
}

export async function apiGenerate(
  apiKey: string,
  payload: ApiGenerateRequest,
  requestId?: string,
): Promise<ApiGenerateResponse> {
  const normalizedKey = apiKey.trim();
  if (!normalizedKey) throw new Error('API key is required.');

  const endpoint = getApiGenerateEndpoint();
  if (!endpoint) {
    throw new Error('API generate endpoint is not configured.');
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-api-key': normalizedKey,
  };
  if (requestId?.trim()) {
    headers['x-request-id'] = requestId.trim();
  }

  const startedAt = Date.now();
  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  const parsed = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  if (!response.ok) {
    const message =
      normalizeString(parsed?.error) ||
      normalizeString((parsed?.details as Record<string, unknown> | undefined)?.error) ||
      `API generation failed (${response.status}).`;
    trackEvent('api_usage', {
      endpoint: 'api_generate',
      status: 'error',
      durationMs: Date.now() - startedAt,
    });
    trackEvent('api_errors', {
      endpoint: 'api_generate',
      reason: message,
      statusCode: response.status,
    });
    return {
      success: false,
      error: message,
      requestId:
        normalizeString(
          (parsed?.details as Record<string, unknown> | undefined)?.requestId,
        ) ?? undefined,
    };
  }

  trackEvent('api_usage', {
    endpoint: 'api_generate',
    status: 'success',
    durationMs: Date.now() - startedAt,
  });

  return {
    success: parsed?.success === true,
    generationId: normalizeString(parsed?.generationId) ?? undefined,
    status: normalizeString(parsed?.status) ?? undefined,
    outputUrl: normalizeString(parsed?.outputUrl) ?? undefined,
    previewUrl: normalizeString(parsed?.previewUrl) ?? undefined,
    requestId: normalizeString(parsed?.requestId) ?? undefined,
    error: normalizeString(parsed?.error) ?? undefined,
  };
}
