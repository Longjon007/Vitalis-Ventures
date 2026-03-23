// Supabase Edge Function: AI Generation Proxy
// Keeps the Replicate API key server-side. Clients authenticate via Supabase JWT.
//
// Deploy: supabase functions deploy ai-generate --no-verify-jwt
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
  safeLogInfo,
  safeLogWarn,
  withRequestIdDetails,
  withRequestIdHeader,
} from '../_shared/validation.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const REPLICATE_API_TOKEN =
  Deno.env.get('REPLICATE_API_TOKEN') ?? Deno.env.get('REPLICATE_API_KEY') ?? '';

const REQUIRED_ENV_MISSING = !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !REPLICATE_API_TOKEN;

const supabase = REQUIRED_ENV_MISSING
  ? null
  : createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

const TIER_LIMITS: Record<string, { maxGenerations: number; maxDuration: number }> = {
  free: { maxGenerations: 3, maxDuration: 15 },
  pro: { maxGenerations: 50, maxDuration: 120 },
  studio: { maxGenerations: 999999, maxDuration: 300 },
};

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
      safeLogWarn('ai_generate.options.blocked_origin', { requestId });
      return errorWithRequestId(403, 'Origin not allowed.', corsHeaders);
    }
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return errorWithRequestId(405, 'Method not allowed.', corsHeaders);
  }

  if (!isOriginAllowed(req, allowedOrigins)) {
    safeLogWarn('ai_generate.blocked_origin', {
      requestId,
      origin: req.headers.get('origin') ?? null,
    });
    return errorWithRequestId(403, 'Origin not allowed.', corsHeaders);
  }

  if (REQUIRED_ENV_MISSING || !supabase) {
    return errorWithRequestId(
      500,
      'AI generation proxy is not configured. Required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, REPLICATE_API_TOKEN.',
      corsHeaders,
    );
  }

  const authenticatedUserId = await getAuthenticatedUserId(req);
  if (!authenticatedUserId) {
    safeLogWarn('ai_generate.missing_auth', { requestId });
    return errorWithRequestId(401, 'Missing authorization.', corsHeaders);
  }

  const ip = getClientIp(req);
  const userLimit = applyRateLimit({
    namespace: 'ai_generate:user',
    identifier: authenticatedUserId,
    limit: 20,
    windowMs: 10 * 60 * 1000,
  });
  const ipLimit = applyRateLimit({
    namespace: 'ai_generate:ip',
    identifier: ip,
    limit: 40,
    windowMs: 10 * 60 * 1000,
  });

  const responseHeaders = { ...corsHeaders, ...userLimit.headers, ...ipLimit.headers };
  if (!userLimit.allowed || !ipLimit.allowed) {
    safeLogWarn('ai_generate.rate_limited', { requestId, userId: authenticatedUserId, ip });
    return errorWithRequestId(
      429,
      'Too many generation attempts. Please retry shortly.',
      responseHeaders,
    );
  }

  try {
    // Get user profile + limits
    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_tier, ai_generations_used, ai_generations_reset_at')
      .eq('id', authenticatedUserId)
      .single();

    if (!profile) {
      return errorWithRequestId(404, 'Profile not found.', responseHeaders);
    }

    // Check monthly reset
    const resetAt = new Date(profile.ai_generations_reset_at);
    let generationsUsed = profile.ai_generations_used;
    if (new Date() > resetAt) {
      generationsUsed = 0;
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1, 1);
      nextMonth.setHours(0, 0, 0, 0);
      await supabase
        .from('profiles')
        .update({ ai_generations_used: 0, ai_generations_reset_at: nextMonth.toISOString() })
        .eq('id', authenticatedUserId);
    }

    const limits = TIER_LIMITS[profile.subscription_tier] || TIER_LIMITS.free;

    if (generationsUsed >= limits.maxGenerations) {
      return errorWithRequestId(
        429,
        'Monthly generation limit reached. Upgrade your plan.',
        responseHeaders,
      );
    }

    // Parse and validate request body
    const rawBody = await req.json().catch(() => null);
    if (!isJsonRecord(rawBody)) {
      safeLogWarn('ai_generate.invalid_payload', { requestId, reason: 'json_parse_failed' });
      return errorWithRequestId(400, 'Invalid request payload.', responseHeaders);
    }
    const body = rawBody as Record<string, unknown>;

    const version = normalizeString(body.version);
    if (!version) {
      return errorWithRequestId(400, 'Missing or invalid "version" field.', responseHeaders);
    }

    const input = body.input;
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      return errorWithRequestId(400, 'Missing or invalid "input" field.', responseHeaders);
    }

    const inputRecord = input as Record<string, unknown>;

    // Enforce duration limit
    if (typeof inputRecord.duration === 'number' && inputRecord.duration > limits.maxDuration) {
      inputRecord.duration = limits.maxDuration;
    }

    // Forward to Replicate
    const replicateRes = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${REPLICATE_API_TOKEN}`,
        'Content-Type': 'application/json',
        Prefer: 'respond-async',
      },
      body: JSON.stringify({ version, input: inputRecord }),
    });

    const prediction = (await replicateRes.json().catch(() => null)) as Record<string, unknown> | null;

    if (!replicateRes.ok) {
      const detail = prediction ? normalizeString(prediction.detail) : null;
      safeLogWarn('ai_generate.replicate_error', {
        requestId,
        userId: authenticatedUserId,
        status: replicateRes.status,
        detail,
      });
      return errorWithRequestId(
        replicateRes.status,
        detail ?? 'Replicate API error.',
        responseHeaders,
      );
    }

    // Increment generation count
    await supabase
      .from('profiles')
      .update({ ai_generations_used: generationsUsed + 1 })
      .eq('id', authenticatedUserId);

    // Log generation
    await supabase.from('ai_generations').insert({
      user_id: authenticatedUserId,
      prompt: normalizeString(inputRecord.prompt) || normalizeString(inputRecord.description) || '',
      model: typeof version === 'string' && version.includes('stable-audio') ? 'stableAudio25' : 'musicgen',
      duration: typeof inputRecord.duration === 'number' ? inputRecord.duration : 15,
      status: 'pending',
    });

    safeLogInfo('ai_generate.forwarded', {
      requestId,
      userId: authenticatedUserId,
      predictionId: prediction ? normalizeString(prediction.id) : null,
    });

    return jsonResponse(prediction ?? {}, 200, responseHeaders);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error.';
    safeLogWarn('ai_generate.failed', { requestId, userId: authenticatedUserId, reason: message });
    return errorWithRequestId(500, message, responseHeaders);
  }
});
