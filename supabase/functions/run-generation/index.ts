// Supabase Edge Function: run-generation
//
// Deploy: supabase functions deploy run-generation --no-verify-jwt
// Required secrets:
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//   REPLICATE_API_TOKEN
//   ALLOWED_ORIGINS (comma-separated) or APP_ORIGIN
// Optional secrets:
//   REPLICATE_MODEL_VERSION

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
  requireUuid,
  safeLogInfo,
  safeLogWarn,
  withRequestIdDetails,
  withRequestIdHeader,
} from '../_shared/validation.ts';

type RunGenerationBody = {
  generationId?: string;
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

const SUPPORTED_MODES = ['standard', 'variation', 'extend', 'remix'] as const;
const MIN_PROMPT_LEN = 2;
const MAX_PROMPT_LEN = 1000;
const MIN_BPM = 40;
const MAX_BPM = 240;
const MIN_DURATION_SECONDS = 5;
const MAX_DURATION_SECONDS = 300;
const GENRE_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N}\s\-+&/',.()]{1,119}$/u;
const KEY_SIGNATURE_PATTERN = /^[A-G](?:#|b)?(?:\s?(?:m|maj|min|major|minor))?$/i;

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const REPLICATE_API_TOKEN = Deno.env.get('REPLICATE_API_TOKEN') ?? '';
const REPLICATE_MODEL_VERSION =
  Deno.env.get('REPLICATE_MODEL_VERSION') ??
  'meta/musicgen:671ac645ce5e552cc63a54a2bbff63fcf798043055d2dac5fc9e36a837eedbb';

const REQUIRED_ENV_MISSING = !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY;

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

async function getAuthenticatedUserId(req: Request): Promise<string | null> {
  if (!supabase) return null;
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) return null;

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) return null;
  return user.id;
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

async function createReplicatePrediction(input: Record<string, unknown>): Promise<ReplicatePrediction> {
  if (!REPLICATE_API_TOKEN) {
    throw new Error('REPLICATE_API_TOKEN is not configured on the backend.');
  }

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
  if (typeof output === 'string') {
    return normalizeString(output);
  }
  if (Array.isArray(output) && output.length > 0) {
    return normalizeString(output[0]);
  }
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

function validatePayload(body: RunGenerationBody): {
  ok: true;
  value: {
    generationId: string;
    prompt: string;
    mode: string;
    genre: string;
    bpm: number;
    keySignature: string;
    duration: number;
  };
} | { ok: false; error: string } {
  const generationIdResult = requireUuid(body.generationId, 'generationId');
  if (!generationIdResult.ok) return generationIdResult;

  const promptResult = requireString(body.prompt, 'prompt', {
    minLength: MIN_PROMPT_LEN,
    maxLength: MAX_PROMPT_LEN,
  });
  if (!promptResult.ok) return promptResult;

  const modeResult = requireEnum(body.mode, SUPPORTED_MODES, 'mode');
  if (!modeResult.ok) return modeResult;

  const genreResult = requireString(body.genre, 'genre', { minLength: 2, maxLength: 120 });
  if (!genreResult.ok) return genreResult;
  if (!GENRE_PATTERN.test(genreResult.value)) {
    return {
      ok: false,
      error: 'genre contains unsupported characters.',
    };
  }

  const bpmResult = requireNumberInRange(body.bpm, 'bpm', MIN_BPM, MAX_BPM);
  if (!bpmResult.ok) return bpmResult;

  const keyResult = requireString(body.keySignature, 'keySignature', { minLength: 1, maxLength: 16 });
  if (!keyResult.ok) return keyResult;
  if (!KEY_SIGNATURE_PATTERN.test(keyResult.value)) {
    return {
      ok: false,
      error: 'keySignature must be a musical key like C, F#, Am, or Bb minor.',
    };
  }

  const durationResult = requireNumberInRange(
    body.duration,
    'duration',
    MIN_DURATION_SECONDS,
    MAX_DURATION_SECONDS,
    { integer: true },
  );
  if (!durationResult.ok) return durationResult;

  return {
    ok: true,
    value: {
      generationId: generationIdResult.value,
      prompt: promptResult.value,
      mode: modeResult.value,
      genre: genreResult.value,
      bpm: bpmResult.value,
      keySignature: keyResult.value,
      duration: durationResult.value,
    },
  };
}

Deno.serve(async (req: Request) => {
  const requestId = getOrCreateRequestId(req);
  const allowedOrigins = parseAllowedOriginsFromEnv();
  const corsHeaders = withRequestIdHeader(buildCorsHeaders(req, allowedOrigins, {
    exposeHeaders: [
      'X-RateLimit-Limit',
      'X-RateLimit-Remaining',
      'X-RateLimit-Reset',
      'Retry-After',
      'X-Request-Id',
    ],
  }), requestId);
  const errorWithRequestId = (
    status: number,
    message: string,
    headers: HeadersInit,
    details?: Record<string, unknown>,
  ) => errorResponse(status, message, headers, withRequestIdDetails(requestId, details));

  if (req.method === 'OPTIONS') {
    if (!isOriginAllowed(req, allowedOrigins)) {
      safeLogWarn('generation.options.blocked_origin', { requestId });
      return errorWithRequestId(403, 'Origin not allowed.', corsHeaders);
    }
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return errorWithRequestId(405, 'Method not allowed.', corsHeaders);
  }

  if (!isOriginAllowed(req, allowedOrigins)) {
    safeLogWarn('generation.blocked_origin', {
      requestId,
      origin: req.headers.get('origin') ?? null,
    });
    return errorWithRequestId(403, 'Origin not allowed.', corsHeaders);
  }

  if (REQUIRED_ENV_MISSING || !supabase) {
    return errorWithRequestId(
      500,
      'Run-generation endpoint is not configured. Required: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.',
      corsHeaders,
    );
  }

  const authenticatedUserId = await getAuthenticatedUserId(req);
  if (!authenticatedUserId) {
    safeLogWarn('generation.missing_auth', { requestId });
    return errorWithRequestId(401, 'You must be authenticated to run a generation.', corsHeaders);
  }

  const ip = getClientIp(req);
  const userLimit = applyRateLimit({
    namespace: 'generation:user',
    identifier: authenticatedUserId,
    limit: 20,
    windowMs: 10 * 60 * 1000,
  });
  const ipLimit = applyRateLimit({
    namespace: 'generation:ip',
    identifier: ip,
    limit: 40,
    windowMs: 10 * 60 * 1000,
  });

  const responseHeaders = { ...corsHeaders, ...userLimit.headers, ...ipLimit.headers };
  if (!userLimit.allowed || !ipLimit.allowed) {
    safeLogWarn('generation.rate_limited', { requestId, userId: authenticatedUserId, ip });
    return errorWithRequestId(
      429,
      'Too many generation attempts. Please retry shortly.',
      responseHeaders,
    );
  }

  const rawBody = await req.json().catch(() => null);
  if (!isJsonRecord(rawBody)) {
    safeLogWarn('generation.invalid_payload', {
      requestId,
      reason: 'json_parse_failed',
      userId: authenticatedUserId,
    });
    return errorWithRequestId(400, 'Invalid request payload.', responseHeaders);
  }
  const body = rawBody as RunGenerationBody;

  const validated = validatePayload(body);
  if (!validated.ok) {
    safeLogWarn('generation.invalid_payload', {
      requestId,
      reason: validated.error,
      userId: authenticatedUserId,
    });
    return errorWithRequestId(400, validated.error, responseHeaders);
  }

  const {
    generationId,
    prompt,
    mode,
    genre,
    bpm,
    keySignature,
    duration,
  } = validated.value;

  try {
    const { data: generation, error: generationError } = await supabase
      .from('ai_generations')
      .select('id, user_id, status')
      .eq('id', generationId)
      .maybeSingle();

    if (generationError) {
      return errorWithRequestId(
        500,
        generationError.message || 'Failed to find generation row.',
        responseHeaders,
      );
    }
    if (!generation) {
      return errorWithRequestId(404, 'Generation not found.', responseHeaders);
    }
    if (generation.user_id !== authenticatedUserId) {
      return errorWithRequestId(403, 'You do not have access to this generation.', responseHeaders);
    }

    await updateGeneration(generationId, {
      status: 'processing',
      error_message: null,
    });

    if (!REPLICATE_API_TOKEN) {
      const envError = 'REPLICATE_API_TOKEN is not configured on the backend.';
      await updateGeneration(generationId, {
        status: 'failed',
        error_message: envError,
      });
      return errorWithRequestId(500, envError, responseHeaders);
    }

    const replicatePrompt = buildPrompt({
      prompt,
      genre,
      bpm,
      keySignature,
    });

    const prediction = await createReplicatePrediction({
      prompt: replicatePrompt,
      duration,
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
          status: 'failed',
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
      return errorWithRequestId(
        500,
        noOutputMessage,
        responseHeaders,
        {
          status: 'failed',
          generationId,
          predictionId: prediction.id,
        },
      );
    }

    await updateGeneration(generationId, {
      status: 'completed',
      output_url: outputUrl,
      preview_url: outputUrl,
      error_message: null,
      mode,
    });

    safeLogInfo('generation.completed', {
      requestId,
      userId: authenticatedUserId,
      generationId,
      predictionId: prediction.id,
    });

    return jsonResponse(
      {
        success: true,
        status: 'completed',
        generationId,
        predictionId: prediction.id,
        outputUrl,
        previewUrl: outputUrl,
      },
      200,
      responseHeaders,
    );
  } catch (err) {
    const message = toGenerationFailureMessage(err);

    try {
      await updateGeneration(generationId, {
        status: 'failed',
        error_message: message,
      });
    } catch {
      // Ignore secondary persistence errors.
    }

    safeLogWarn('generation.failed', {
      requestId,
      userId: authenticatedUserId,
      generationId,
      reason: message,
    });

    return errorWithRequestId(
      500,
      message,
      responseHeaders,
      {
        status: 'failed',
        generationId,
      },
    );
  }
});
