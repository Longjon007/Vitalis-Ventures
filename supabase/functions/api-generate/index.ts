// Supabase Edge Function: api-generate
//
// Deploy: supabase functions deploy api-generate --no-verify-jwt
// Recommended public route alias: /api/generate
// Required secrets:
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//   REPLICATE_API_TOKEN (or REPLICATE_API_KEY)
//   ALLOWED_ORIGINS (comma-separated) or APP_ORIGIN

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { applyRateLimit, getClientIp } from '../_shared/rate-limit.ts';
import {
  buildCorsHeaders,
  errorResponse,
  getOrCreateRequestId,
  isJsonRecord,
  isOriginAllowed,
  jsonResponse,
  normalizeString,
  parseAllowedOriginsFromEnv,
  requireEnum,
  requireNumberInRange,
  requireString,
  safeLogInfo,
  safeLogWarn,
  withRequestIdDetails,
  withRequestIdHeader,
} from '../_shared/validation.ts';

type ApiGenerateBody = {
  prompt?: string;
  mode?: string;
  genre?: string;
  bpm?: number;
  keySignature?: string;
  duration?: number;
};

type ReplicatePrediction = {
  id: string;
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';
  output: string | string[] | null;
  error: string | null;
};

type StyleProfile = {
  preferred_genres?: string[];
  bpm_min?: number | null;
  bpm_max?: number | null;
};

const SUPPORTED_MODES = ['standard', 'variation', 'extend', 'remix'] as const;
const MIN_PROMPT_LEN = 2;
const MAX_PROMPT_LEN = 1000;
const MIN_BPM = 40;
const MAX_BPM = 240;
const MIN_DURATION_SECONDS = 5;
const MAX_DURATION_SECONDS = 300;
const KEY_SIGNATURE_PATTERN = /^[A-G](?:#|b)?(?:\s?(?:m|maj|min|major|minor))?$/i;

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const REPLICATE_API_TOKEN =
  Deno.env.get('REPLICATE_API_TOKEN') ?? Deno.env.get('REPLICATE_API_KEY') ?? '';
const REPLICATE_MODEL_VERSION =
  Deno.env.get('REPLICATE_MODEL_VERSION') ??
  'meta/musicgen:671ac645ce5e552cc63a54a2bbff63fcf798043055d2dac5fc9e36a837eedbb';

const REQUIRED_ENV_MISSING =
  !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !REPLICATE_API_TOKEN;

const supabase = REQUIRED_ENV_MISSING
  ? null
  : createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

const REPLICATE_BASE_URL = 'https://api.replicate.com/v1';
const POLL_INTERVAL_MS = 2500;
const POLL_MAX_ATTEMPTS = 70;

function getApiKeyFromRequest(req: Request): string | null {
  const fromHeader = normalizeString(req.headers.get('x-api-key'));
  if (fromHeader) return fromHeader;

  const authHeader = req.headers.get('authorization');
  if (authHeader?.toLowerCase().startsWith('bearer ')) {
    const token = normalizeString(authHeader.slice(7));
    if (token) return token;
  }
  return null;
}

async function sha256Hex(value: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(value);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function resolveApiKeyOwner(
  keyHash: string,
): Promise<{ apiKeyId: string; userId: string; isActive: boolean } | null> {
  if (!supabase) return null;

  const rpcResult = await supabase.rpc('resolve_api_key_owner', {
    p_key_hash: keyHash,
  });

  if (!rpcResult.error && Array.isArray(rpcResult.data) && rpcResult.data.length > 0) {
    const first = rpcResult.data[0] as Record<string, unknown>;
    const apiKeyId = normalizeString(first.api_key_id);
    const userId = normalizeString(first.user_id);
    const isActive = first.is_active === true;
    if (apiKeyId && userId) {
      return { apiKeyId, userId, isActive };
    }
  }

  const { data, error } = await supabase
    .from('api_keys')
    .select('id, user_id, is_active')
    .eq('key_hash', keyHash)
    .maybeSingle();

  if (error || !data) return null;

  return {
    apiKeyId: data.id as string,
    userId: data.user_id as string,
    isActive: data.is_active === true,
  };
}

async function touchApiKeyUse(apiKeyId: string): Promise<void> {
  if (!supabase) return;

  const rpcResult = await supabase.rpc('touch_api_key_use', {
    p_api_key_id: apiKeyId,
  });
  if (!rpcResult.error) return;

  await supabase
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', apiKeyId);
}

async function getUserStyleProfile(userId: string): Promise<StyleProfile | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('user_style_profiles')
    .select('preferred_genres, bpm_min, bpm_max')
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !data) return null;
  return {
    preferred_genres: Array.isArray(data.preferred_genres)
      ? data.preferred_genres.filter((item: unknown): item is string => typeof item === 'string')
      : [],
    bpm_min: typeof data.bpm_min === 'number' ? data.bpm_min : null,
    bpm_max: typeof data.bpm_max === 'number' ? data.bpm_max : null,
  };
}

function toGenerationFailureMessage(err: unknown, fallback = 'Generation failed.'): string {
  if (err instanceof Error) {
    const message = normalizeString(err.message);
    return message ?? fallback;
  }
  const message = normalizeString(err);
  return message ?? fallback;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function createReplicatePrediction(input: Record<string, unknown>): Promise<ReplicatePrediction> {
  const response = await fetch(`${REPLICATE_BASE_URL}/predictions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${REPLICATE_API_TOKEN}`,
      'Content-Type': 'application/json',
      Prefer: 'respond-async',
    },
    body: JSON.stringify({
      version: REPLICATE_MODEL_VERSION,
      input,
    }),
  });

  const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  if (!response.ok) {
    const detail = payload ? normalizeString(payload.detail) : null;
    throw new Error(detail ?? `Replicate create prediction failed (${response.status}).`);
  }

  const id = payload ? normalizeString(payload.id) : null;
  const status = payload ? normalizeString(payload.status) : null;
  if (!id || !status) {
    throw new Error('Replicate returned an invalid prediction payload.');
  }

  return {
    id,
    status: status as ReplicatePrediction['status'],
    output: (payload?.output as ReplicatePrediction['output']) ?? null,
    error: (payload?.error as string | null) ?? null,
  };
}

async function getReplicatePrediction(predictionId: string): Promise<ReplicatePrediction> {
  const response = await fetch(`${REPLICATE_BASE_URL}/predictions/${predictionId}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${REPLICATE_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
  });

  const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  if (!response.ok || !payload) {
    const detail = payload ? normalizeString(payload.detail) : null;
    throw new Error(detail ?? `Replicate poll failed (${response.status}).`);
  }

  return {
    id: normalizeString(payload.id) ?? predictionId,
    status: (normalizeString(payload.status) as ReplicatePrediction['status']) ?? 'failed',
    output: (payload.output as ReplicatePrediction['output']) ?? null,
    error: (payload.error as string | null) ?? null,
  };
}

function extractAudioUrl(output: string | string[] | null): string | null {
  if (typeof output === 'string') return normalizeString(output);
  if (Array.isArray(output) && output.length > 0) return normalizeString(output[0]);
  return null;
}

function buildPrompt(args: {
  prompt: string;
  genre: string;
  bpm: number;
  keySignature: string;
}): string {
  return [
    args.prompt,
    `Genre: ${args.genre}`,
    `Tempo: ${Math.round(args.bpm)} BPM`,
    `Key: ${args.keySignature}`,
  ].join('. ');
}

function validatePayload(
  body: ApiGenerateBody,
  styleProfile: StyleProfile | null,
): {
  ok: true;
  value: {
    prompt: string;
    mode: string;
    genre: string;
    bpm: number;
    keySignature: string;
    duration: number;
  };
} | { ok: false; error: string } {
  const promptResult = requireString(body.prompt, 'prompt', {
    minLength: MIN_PROMPT_LEN,
    maxLength: MAX_PROMPT_LEN,
  });
  if (!promptResult.ok) return promptResult;

  const modeResult = requireEnum(
    body.mode ?? 'standard',
    SUPPORTED_MODES,
    'mode',
  );
  if (!modeResult.ok) return modeResult;

  const fallbackGenre =
    styleProfile?.preferred_genres?.[0] && normalizeString(styleProfile.preferred_genres[0])
      ? normalizeString(styleProfile.preferred_genres[0])!
      : 'cinematic';
  const genreResult = requireString(body.genre ?? fallbackGenre, 'genre', {
    minLength: 2,
    maxLength: 120,
  });
  if (!genreResult.ok) return genreResult;

  const inferredBpm =
    styleProfile?.bpm_min && styleProfile?.bpm_max
      ? Math.round((styleProfile.bpm_min + styleProfile.bpm_max) / 2)
      : 120;
  const bpmResult = requireNumberInRange(body.bpm ?? inferredBpm, 'bpm', MIN_BPM, MAX_BPM);
  if (!bpmResult.ok) return bpmResult;

  const keyResult = requireString(body.keySignature ?? 'Am', 'keySignature', {
    minLength: 1,
    maxLength: 16,
  });
  if (!keyResult.ok) return keyResult;
  if (!KEY_SIGNATURE_PATTERN.test(keyResult.value)) {
    return {
      ok: false,
      error: 'keySignature must be a musical key like C, F#, Am, or Bb minor.',
    };
  }

  const durationResult = requireNumberInRange(
    body.duration ?? 60,
    'duration',
    MIN_DURATION_SECONDS,
    MAX_DURATION_SECONDS,
    { integer: true },
  );
  if (!durationResult.ok) return durationResult;

  return {
    ok: true,
    value: {
      prompt: promptResult.value,
      mode: modeResult.value,
      genre: genreResult.value,
      bpm: bpmResult.value,
      keySignature: keyResult.value,
      duration: durationResult.value,
    },
  };
}

async function createGenerationRow(
  userId: string,
  payload: {
    prompt: string;
    mode: string;
    genre: string;
    bpm: number;
    keySignature: string;
    duration: number;
  },
): Promise<string> {
  if (!supabase) throw new Error('Supabase service client is not configured.');

  const insertPayload: Record<string, unknown> = {
    user_id: userId,
    prompt: payload.prompt,
    mode: payload.mode,
    provider: 'replicate',
    status: 'processing',
    input_params: {
      genre: payload.genre,
      bpm: payload.bpm,
      keySignature: payload.keySignature,
      duration: payload.duration,
    },
    credits_used: 0,
    error_message: null,
  };

  const { data, error } = await supabase
    .from('ai_generations')
    .insert(insertPayload)
    .select('id')
    .single();

  if (error || !data?.id) {
    throw new Error(error?.message ?? 'Failed to create generation row.');
  }

  return data.id as string;
}

async function updateGeneration(
  generationId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  if (!supabase) {
    throw new Error('Supabase service client is not configured.');
  }

  const { error } = await supabase
    .from('ai_generations')
    .update({
      ...patch,
      updated_at: new Date().toISOString(),
    })
    .eq('id', generationId);

  if (error) {
    throw new Error(error.message || 'Failed to update generation status.');
  }
}

Deno.serve(async (req: Request) => {
  const requestId = getOrCreateRequestId(req);
  const allowedOrigins = parseAllowedOriginsFromEnv();
  const corsHeaders = withRequestIdHeader(
    buildCorsHeaders(req, allowedOrigins, {
      exposeHeaders: [
        'X-RateLimit-Limit',
        'X-RateLimit-Remaining',
        'X-RateLimit-Reset',
        'Retry-After',
        'X-Request-Id',
      ],
    }),
    requestId,
  );
  const errorWithRequestId = (
    status: number,
    message: string,
    headers: HeadersInit,
    details?: Record<string, unknown>,
  ) => errorResponse(status, message, headers, withRequestIdDetails(requestId, details));

  if (req.method === 'OPTIONS') {
    if (!isOriginAllowed(req, allowedOrigins)) {
      safeLogWarn('api_generate.options.blocked_origin', { requestId });
      return errorWithRequestId(403, 'Origin not allowed.', corsHeaders);
    }
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return errorWithRequestId(405, 'Method not allowed.', corsHeaders);
  }

  if (!isOriginAllowed(req, allowedOrigins)) {
    safeLogWarn('api_generate.blocked_origin', {
      requestId,
      origin: req.headers.get('origin') ?? null,
    });
    return errorWithRequestId(403, 'Origin not allowed.', corsHeaders);
  }

  if (REQUIRED_ENV_MISSING || !supabase) {
    return errorWithRequestId(
      500,
      'API generation endpoint is not configured.',
      corsHeaders,
    );
  }

  const rawKey = getApiKeyFromRequest(req);
  if (!rawKey) {
    return errorWithRequestId(401, 'API key is required. Pass x-api-key header.', corsHeaders);
  }

  const keyHash = await sha256Hex(rawKey);
  const owner = await resolveApiKeyOwner(keyHash);
  if (!owner || !owner.isActive) {
    safeLogWarn('api_generate.invalid_key', { requestId });
    return errorWithRequestId(401, 'Invalid or inactive API key.', corsHeaders);
  }

  const keyLimit = applyRateLimit({
    namespace: 'api_generate:key',
    identifier: owner.apiKeyId,
    limit: 60,
    windowMs: 10 * 60 * 1000,
  });
  const ipLimit = applyRateLimit({
    namespace: 'api_generate:ip',
    identifier: getClientIp(req),
    limit: 120,
    windowMs: 10 * 60 * 1000,
  });
  const responseHeaders = { ...corsHeaders, ...keyLimit.headers, ...ipLimit.headers };
  if (!keyLimit.allowed || !ipLimit.allowed) {
    safeLogWarn('api_generate.rate_limited', { requestId, apiKeyId: owner.apiKeyId });
    return errorWithRequestId(429, 'Rate limit exceeded.', responseHeaders);
  }

  const rawBody = await req.json().catch(() => null);
  if (!isJsonRecord(rawBody)) {
    safeLogWarn('api_generate.invalid_payload', { requestId, reason: 'json_parse_failed' });
    return errorWithRequestId(400, 'Invalid request payload.', responseHeaders);
  }
  const body = rawBody as ApiGenerateBody;

  const styleProfile = await getUserStyleProfile(owner.userId);
  const validated = validatePayload(body, styleProfile);
  if (!validated.ok) {
    safeLogWarn('api_generate.invalid_payload', { requestId, reason: validated.error });
    return errorWithRequestId(400, validated.error, responseHeaders);
  }

  const payload = validated.value;
  let generationId: string | null = null;

  try {
    generationId = await createGenerationRow(owner.userId, payload);

    const replicatePrompt = buildPrompt({
      prompt: payload.prompt,
      genre: payload.genre,
      bpm: payload.bpm,
      keySignature: payload.keySignature,
    });

    const prediction = await createReplicatePrediction({
      prompt: replicatePrompt,
      duration: payload.duration,
      output_format: 'wav',
    });

    let finalPrediction = prediction;
    for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt += 1) {
      if (finalPrediction.status === 'succeeded') break;
      if (finalPrediction.status === 'failed') break;
      if (finalPrediction.status === 'canceled') break;

      await sleep(POLL_INTERVAL_MS);
      finalPrediction = await getReplicatePrediction(prediction.id);
    }

    if (finalPrediction.status !== 'succeeded') {
      const failureMessage =
        normalizeString(finalPrediction.error) ??
        (finalPrediction.status === 'canceled'
          ? 'Generation was canceled.'
          : 'Generation did not complete successfully.');

      await updateGeneration(generationId, {
        status: 'failed',
        error_message: failureMessage,
      });

      return errorWithRequestId(
        500,
        failureMessage,
        responseHeaders,
        {
          generationId,
          predictionId: prediction.id,
        },
      );
    }

    const outputUrl = extractAudioUrl(finalPrediction.output);
    if (!outputUrl) {
      const noOutputMessage = 'Generation completed but no output URL was returned.';
      await updateGeneration(generationId, {
        status: 'failed',
        error_message: noOutputMessage,
      });
      return errorWithRequestId(500, noOutputMessage, responseHeaders, { generationId });
    }

    await updateGeneration(generationId, {
      status: 'completed',
      output_url: outputUrl,
      preview_url: outputUrl,
      error_message: null,
      mode: payload.mode,
    });
    await touchApiKeyUse(owner.apiKeyId);

    safeLogInfo('api_generate.completed', {
      requestId,
      apiKeyId: owner.apiKeyId,
      userId: owner.userId,
      generationId,
    });

    return jsonResponse(
      {
        success: true,
        generationId,
        status: 'completed',
        outputUrl,
        previewUrl: outputUrl,
        requestId,
      },
      200,
      responseHeaders,
    );
  } catch (err) {
    const message = toGenerationFailureMessage(err);
    if (generationId) {
      try {
        await updateGeneration(generationId, {
          status: 'failed',
          error_message: message,
        });
      } catch {
        // ignore secondary failures
      }
    }

    safeLogWarn('api_generate.failed', {
      requestId,
      apiKeyId: owner.apiKeyId,
      generationId,
      reason: message,
    });

    return errorWithRequestId(
      500,
      message,
      responseHeaders,
      generationId ? { generationId } : undefined,
    );
  }
});
