// Supabase Edge Function: create-portal-session
//
// Deploy: supabase functions deploy create-portal-session --no-verify-jwt
// Required secrets:
//   STRIPE_SECRET_KEY
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//   ALLOWED_ORIGINS (comma-separated) or APP_ORIGIN

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14.25.0?target=denonext';
import { applyRateLimit, getClientIp } from '../_shared/rate-limit.ts';
import {
  buildCorsHeaders,
  errorResponse,
  getOrCreateRequestId,
  isJsonRecord,
  isAllowedHttpUrl,
  isOriginAllowed,
  jsonResponse,
  normalizeString,
  parseAllowedOriginsFromEnv,
  requireString,
  safeLogInfo,
  safeLogWarn,
  withRequestIdDetails,
  withRequestIdHeader,
} from '../_shared/validation.ts';

type PortalRequestBody = {
  returnUrl?: string;
  userId?: string;
};

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const REQUIRED_ENV_MISSING = !STRIPE_SECRET_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY;

const stripe = REQUIRED_ENV_MISSING
  ? null
  : new Stripe(STRIPE_SECRET_KEY, {
      apiVersion: '2023-10-16',
    });

const supabase = REQUIRED_ENV_MISSING
  ? null
  : createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

async function resolveAuthenticatedUserId(req: Request): Promise<string | null> {
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

async function resolveStripeCustomerIdForUser(userId: string): Promise<string | null> {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', userId)
    .maybeSingle();

  if (error || !data) return null;
  return normalizeString(data.stripe_customer_id);
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
      safeLogWarn('portal.options.blocked_origin', { requestId });
      return errorWithRequestId(403, 'Origin not allowed.', corsHeaders);
    }
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return errorWithRequestId(405, 'Method not allowed.', corsHeaders);
  }

  if (!isOriginAllowed(req, allowedOrigins)) {
    safeLogWarn('portal.blocked_origin', {
      requestId,
      origin: req.headers.get('origin') ?? null,
    });
    return errorWithRequestId(403, 'Origin not allowed.', corsHeaders);
  }

  if (REQUIRED_ENV_MISSING || !stripe || !supabase) {
    return errorWithRequestId(
      500,
      'Billing portal endpoint is not configured. Required backend env: STRIPE_SECRET_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.',
      corsHeaders,
    );
  }

  const rawBody = await req.json().catch(() => null);
  if (!isJsonRecord(rawBody)) {
    safeLogWarn('portal.invalid_payload', { requestId, reason: 'json_parse_failed' });
    return errorWithRequestId(400, 'Invalid request payload.', corsHeaders);
  }
  const body = rawBody as PortalRequestBody;

  const returnUrlResult = requireString(body.returnUrl, 'returnUrl', { maxLength: 2048 });
  if (!returnUrlResult.ok) {
    return errorWithRequestId(400, returnUrlResult.error, corsHeaders);
  }
  if (!isAllowedHttpUrl(returnUrlResult.value, allowedOrigins)) {
    safeLogWarn('portal.invalid_return_url_origin', { requestId });
    return errorWithRequestId(400, 'returnUrl origin is not allowed.', corsHeaders);
  }

  const authenticatedUserId = await resolveAuthenticatedUserId(req);
  if (!authenticatedUserId) {
    safeLogWarn('portal.missing_auth', { requestId });
    return errorWithRequestId(401, 'You must be signed in to open the billing portal.', corsHeaders);
  }

  const requestedUserId = normalizeString(body.userId);
  if (requestedUserId && requestedUserId !== authenticatedUserId) {
    safeLogWarn('portal.user_mismatch', { requestId });
    return errorWithRequestId(403, 'Request user identity mismatch.', corsHeaders);
  }

  const ip = getClientIp(req);
  const userLimit = applyRateLimit({
    namespace: 'portal:user',
    identifier: authenticatedUserId,
    limit: 20,
    windowMs: 10 * 60 * 1000,
  });

  const ipLimit = applyRateLimit({
    namespace: 'portal:ip',
    identifier: ip,
    limit: 20,
    windowMs: 10 * 60 * 1000,
  });

  const responseHeaders = { ...corsHeaders, ...userLimit.headers, ...ipLimit.headers };
  if (!userLimit.allowed || !ipLimit.allowed) {
    safeLogWarn('portal.rate_limited', { requestId, userId: authenticatedUserId, ip });
    return errorWithRequestId(
      429,
      'Too many billing portal attempts. Please retry shortly.',
      responseHeaders,
    );
  }

  const stripeCustomerId = await resolveStripeCustomerIdForUser(authenticatedUserId);
  if (!stripeCustomerId) {
    safeLogWarn('portal.missing_customer', { requestId, userId: authenticatedUserId });
    return errorWithRequestId(
      404,
      'No Stripe customer is linked to this account yet. Complete checkout first, then try again.',
      responseHeaders,
    );
  }

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: returnUrlResult.value,
    });

    const url = normalizeString(session.url);
    if (!url) {
      return errorWithRequestId(500, 'Stripe did not return a billing portal URL.', responseHeaders);
    }

    safeLogInfo('portal.created', { requestId, userId: authenticatedUserId, ip });
    return jsonResponse({ url }, 200, responseHeaders);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create billing portal session.';
    safeLogWarn('portal.failed', { requestId, userId: authenticatedUserId, ip, reason: message });
    return errorWithRequestId(500, 'Failed to create billing portal session.', responseHeaders);
  }
});
