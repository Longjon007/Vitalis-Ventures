// Supabase Edge Function: create-connect-account
//
// Deploy: supabase functions deploy create-connect-account --no-verify-jwt
// Required secrets:
//   STRIPE_SECRET_KEY
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//   ALLOWED_ORIGINS (comma-separated) or APP_ORIGIN

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
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
  safeLogInfo,
  safeLogWarn,
  withRequestIdDetails,
  withRequestIdHeader,
} from '../_shared/validation.ts';

type ConnectAccountRequest = {
  returnUrl?: string;
  refreshUrl?: string;
};

type StripeErrorPayload = {
  error?: {
    message?: string;
    type?: string;
  };
};

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const APP_ORIGIN = normalizeString(Deno.env.get('APP_ORIGIN'));

const REQUIRED_ENV_MISSING = !STRIPE_SECRET_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY;

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

async function stripePost(path: string, params: URLSearchParams): Promise<Record<string, unknown>> {
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  const payload = (await response.json().catch(() => null)) as
    | Record<string, unknown>
    | StripeErrorPayload
    | null;

  if (!response.ok) {
    const message =
      (payload as StripeErrorPayload | null)?.error?.message ??
      `Stripe request failed (${response.status}).`;
    throw new Error(message);
  }

  return (payload ?? {}) as Record<string, unknown>;
}

function getSafeRedirectUrls(
  payload: ConnectAccountRequest,
  allowedOrigins: string[],
): { returnUrl: string; refreshUrl: string } | null {
  const fallbackOrigin = APP_ORIGIN ?? allowedOrigins[0] ?? null;
  if (!fallbackOrigin) return null;

  const defaultReturn = `${fallbackOrigin}/app/account`;
  const requestedReturn = normalizeString(payload.returnUrl) ?? defaultReturn;
  const requestedRefresh = normalizeString(payload.refreshUrl) ?? defaultReturn;

  if (!isAllowedHttpUrl(requestedReturn, allowedOrigins)) return null;
  if (!isAllowedHttpUrl(requestedRefresh, allowedOrigins)) return null;

  return {
    returnUrl: requestedReturn,
    refreshUrl: requestedRefresh,
  };
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
      safeLogWarn('connect.options.blocked_origin', { requestId });
      return errorWithRequestId(403, 'Origin not allowed.', corsHeaders);
    }
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return errorWithRequestId(405, 'Method not allowed.', corsHeaders);
  }

  if (!isOriginAllowed(req, allowedOrigins)) {
    safeLogWarn('connect.blocked_origin', {
      requestId,
      origin: req.headers.get('origin') ?? null,
    });
    return errorWithRequestId(403, 'Origin not allowed.', corsHeaders);
  }

  if (REQUIRED_ENV_MISSING || !supabase) {
    return errorWithRequestId(
      500,
      'Connect onboarding is not configured. Required: STRIPE_SECRET_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.',
      corsHeaders,
    );
  }

  const userId = await resolveAuthenticatedUserId(req);
  if (!userId) {
    safeLogWarn('connect.missing_auth', { requestId });
    return errorWithRequestId(401, 'Authentication is required.', corsHeaders);
  }

  const ip = getClientIp(req);
  const userLimit = applyRateLimit({
    namespace: 'connect:user',
    identifier: userId,
    limit: 10,
    windowMs: 10 * 60 * 1000,
  });
  const ipLimit = applyRateLimit({
    namespace: 'connect:ip',
    identifier: ip,
    limit: 20,
    windowMs: 10 * 60 * 1000,
  });
  const responseHeaders = { ...corsHeaders, ...userLimit.headers, ...ipLimit.headers };
  if (!userLimit.allowed || !ipLimit.allowed) {
    safeLogWarn('connect.rate_limited', { requestId, userId, ip });
    return errorWithRequestId(429, 'Too many onboarding attempts. Please retry shortly.', responseHeaders);
  }

  const parsedBody = await req.json().catch(() => ({}));
  const body = isJsonRecord(parsedBody) ? (parsedBody as ConnectAccountRequest) : {};
  const redirects = getSafeRedirectUrls(body, allowedOrigins);
  if (!redirects) {
    safeLogWarn('connect.invalid_redirect', { requestId, userId });
    return errorWithRequestId(400, 'Invalid return or refresh URL origin.', responseHeaders);
  }

  try {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('stripe_account_id, payouts_enabled')
      .eq('id', userId)
      .maybeSingle();

    if (profileError) {
      return errorWithRequestId(500, 'Failed to load creator profile.', responseHeaders);
    }
    if (!profile) {
      return errorWithRequestId(404, 'Creator profile not found.', responseHeaders);
    }

    let stripeAccountId = normalizeString(profile.stripe_account_id);
    if (!stripeAccountId) {
      const createParams = new URLSearchParams();
      createParams.append('type', 'express');
      createParams.append('country', 'US');
      createParams.append('capabilities[card_payments][requested]', 'true');
      createParams.append('capabilities[transfers][requested]', 'true');
      createParams.append('metadata[supabase_user_id]', userId);

      const accountPayload = await stripePost('accounts', createParams);
      stripeAccountId = normalizeString(accountPayload.id);
      if (!stripeAccountId) {
        return errorWithRequestId(500, 'Stripe did not return an account id.', responseHeaders);
      }

      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          stripe_account_id: stripeAccountId,
          payouts_enabled: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      if (updateError) {
        return errorWithRequestId(500, 'Failed to store Stripe account mapping.', responseHeaders);
      }
    }

    const accountLinkParams = new URLSearchParams();
    accountLinkParams.append('account', stripeAccountId);
    accountLinkParams.append('type', 'account_onboarding');
    accountLinkParams.append('return_url', redirects.returnUrl);
    accountLinkParams.append('refresh_url', redirects.refreshUrl);
    const accountLinkPayload = await stripePost('account_links', accountLinkParams);
    const onboardingUrl = normalizeString(accountLinkPayload.url);

    if (!onboardingUrl) {
      return errorWithRequestId(500, 'Stripe did not return an onboarding URL.', responseHeaders);
    }

    safeLogInfo('connect.link_created', {
      requestId,
      userId,
      hasExistingAccount: Boolean(profile.stripe_account_id),
      payoutsEnabled: Boolean(profile.payouts_enabled),
    });

    return jsonResponse(
      {
        url: onboardingUrl,
        accountId: stripeAccountId,
        payoutsEnabled: Boolean(profile.payouts_enabled),
        requestId,
      },
      200,
      responseHeaders,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create Stripe Connect onboarding link.';
    safeLogWarn('connect.failed', { requestId, userId, reason: message });
    return errorWithRequestId(500, 'Failed to create payout onboarding link.', responseHeaders);
  }
});
