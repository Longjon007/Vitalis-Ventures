// Supabase Edge Function: create-checkout-session
//
// Deploy: supabase functions deploy create-checkout-session --no-verify-jwt
// Required secrets:
//   STRIPE_SECRET_KEY
//   STRIPE_PRICE_STARTER_ID (optional but recommended)
//   STRIPE_PRICE_PRO_ID
//   STRIPE_PRICE_STUDIO_ID
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
  requireEnum,
  requireString,
  requireUuid,
  safeLogInfo,
  safeLogWarn,
  withRequestIdDetails,
  withRequestIdHeader,
} from '../_shared/validation.ts';

type CheckoutTier = 'starter' | 'pro' | 'studio';
type CheckoutType = 'subscription' | 'marketplace';

type CheckoutRequestBody = {
  checkoutType?: string;
  tier?: string;
  listingId?: string;
  successUrl?: string;
  cancelUrl?: string;
  userId?: string;
  email?: string;
};

type MarketplaceListingContext = {
  listingId: string;
  generationId: string;
  sellerUserId: string;
  priceCents: number;
  licenseType: 'personal' | 'commercial';
  usageRights: string | null;
  prompt: string;
  generationStatus: string;
  isPublic: boolean;
};

const SUPPORTED_TIERS: readonly CheckoutTier[] = ['starter', 'pro', 'studio'];

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY') ?? '';
const STRIPE_PRICE_STARTER_ID = Deno.env.get('STRIPE_PRICE_STARTER_ID') ?? '';
const STRIPE_PRICE_PRO_ID = Deno.env.get('STRIPE_PRICE_PRO_ID') ?? '';
const STRIPE_PRICE_STUDIO_ID = Deno.env.get('STRIPE_PRICE_STUDIO_ID') ?? '';
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

function sanitizeMetadataValue(value: string | null): string | null {
  const normalized = normalizeString(value);
  if (!normalized) return null;

  const withoutControlChars = normalized.replace(/[\u0000-\u001F\u007F]/g, '');
  if (!withoutControlChars) return null;

  // Stripe metadata value max length is 500 chars.
  return withoutControlChars.slice(0, 500);
}

function resolveCheckoutType(value: unknown): CheckoutType {
  const normalized = normalizeString(value)?.toLowerCase();
  if (normalized === 'marketplace') return 'marketplace';
  return 'subscription';
}

function resolvePriceIdForTier(tier: CheckoutTier): string | null {
  if (tier === 'starter') {
    return normalizeString(STRIPE_PRICE_STARTER_ID);
  }
  if (tier === 'pro') {
    return normalizeString(STRIPE_PRICE_PRO_ID);
  }
  return normalizeString(STRIPE_PRICE_STUDIO_ID);
}

function sanitizeProductSnippet(value: string | null, max = 120): string {
  const safe = sanitizeMetadataValue(value) ?? 'MusicForge track';
  return safe.length > max ? `${safe.slice(0, max - 3)}...` : safe;
}

async function resolveMarketplaceListingContext(
  listingId: string,
): Promise<MarketplaceListingContext | null> {
  if (!supabase) return null;

  const { data: listing, error: listingError } = await supabase
    .from('marketplace_listings')
    .select('id, generation_id, user_id, price_cents, is_active, license_type, usage_rights')
    .eq('id', listingId)
    .maybeSingle();

  if (listingError) {
    throw new Error(listingError.message || 'Failed to load marketplace listing.');
  }
  if (!listing) return null;

  const generationId = normalizeString(listing.generation_id);
  const sellerUserId = normalizeString(listing.user_id);

  if (!generationId || !sellerUserId) return null;

  const { data: generation, error: generationError } = await supabase
    .from('ai_generations')
    .select('id, status, prompt, is_public')
    .eq('id', generationId)
    .maybeSingle();

  if (generationError) {
    throw new Error(generationError.message || 'Failed to load listing generation.');
  }
  if (!generation) return null;

  const priceCents = typeof listing.price_cents === 'number' ? listing.price_cents : Number(listing.price_cents);
  const licenseType = normalizeString(listing.license_type)?.toLowerCase() === 'commercial'
    ? 'commercial'
    : 'personal';

  return {
    listingId,
    generationId,
    sellerUserId,
    priceCents: Number.isFinite(priceCents) ? Math.round(priceCents) : 0,
    licenseType,
    usageRights: normalizeString(listing.usage_rights),
    prompt: normalizeString(generation.prompt) ?? 'MusicForge track',
    generationStatus: normalizeString(generation.status)?.toLowerCase() ?? 'unknown',
    isPublic: generation.is_public !== false,
  };
}

async function resolveAuthenticatedUser(
  req: Request,
): Promise<{ id: string; email: string | null } | null> {
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

  return {
    id: user.id,
    email: normalizeString(user.email),
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
      safeLogWarn('checkout.options.blocked_origin', { requestId });
      return errorWithRequestId(403, 'Origin not allowed.', corsHeaders);
    }
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return errorWithRequestId(405, 'Method not allowed.', corsHeaders);
  }

  if (!isOriginAllowed(req, allowedOrigins)) {
    safeLogWarn('checkout.blocked_origin', {
      requestId,
      origin: req.headers.get('origin') ?? null,
    });
    return errorWithRequestId(403, 'Origin not allowed.', corsHeaders);
  }

  const ip = getClientIp(req);
  const ipLimit = applyRateLimit({
    namespace: 'checkout:ip',
    identifier: ip,
    limit: 10,
    windowMs: 10 * 60 * 1000,
  });

  const responseHeaders = { ...corsHeaders, ...ipLimit.headers };
  if (!ipLimit.allowed) {
    safeLogWarn('checkout.rate_limited', { requestId, ip });
    return errorWithRequestId(
      429,
      'Too many checkout attempts. Please retry shortly.',
      responseHeaders,
    );
  }

  if (REQUIRED_ENV_MISSING || !stripe || !supabase) {
    return errorWithRequestId(
      500,
      'Checkout endpoint is not configured. Required backend env: STRIPE_SECRET_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.',
      responseHeaders,
    );
  }

  const rawBody = await req.json().catch(() => null);
  if (!isJsonRecord(rawBody)) {
    safeLogWarn('checkout.invalid_payload', { requestId, reason: 'json_parse_failed', ip });
    return errorWithRequestId(400, 'Invalid request payload.', responseHeaders);
  }
  const body = rawBody as CheckoutRequestBody;

  const successUrlResult = requireString(body.successUrl, 'successUrl', { maxLength: 2048 });
  if (!successUrlResult.ok) {
    return errorWithRequestId(400, successUrlResult.error, responseHeaders);
  }

  const cancelUrlResult = requireString(body.cancelUrl, 'cancelUrl', { maxLength: 2048 });
  if (!cancelUrlResult.ok) {
    return errorWithRequestId(400, cancelUrlResult.error, responseHeaders);
  }

  if (!isAllowedHttpUrl(successUrlResult.value, allowedOrigins)) {
    safeLogWarn('checkout.invalid_redirect_origin', { requestId, field: 'successUrl', ip });
    return errorWithRequestId(400, 'successUrl origin is not allowed.', responseHeaders);
  }

  if (!isAllowedHttpUrl(cancelUrlResult.value, allowedOrigins)) {
    safeLogWarn('checkout.invalid_redirect_origin', { requestId, field: 'cancelUrl', ip });
    return errorWithRequestId(400, 'cancelUrl origin is not allowed.', responseHeaders);
  }

  const checkoutType = resolveCheckoutType(body.checkoutType);
  const authenticatedUser = await resolveAuthenticatedUser(req);

  if (checkoutType === 'marketplace') {
    if (!authenticatedUser) {
      safeLogWarn('checkout.marketplace.missing_auth', { requestId, ip });
      return errorWithRequestId(401, 'Authentication is required for marketplace purchases.', responseHeaders);
    }

    const userLimit = applyRateLimit({
      namespace: 'marketplace_checkout:user',
      identifier: authenticatedUser.id,
      limit: 20,
      windowMs: 10 * 60 * 1000,
    });
    const marketplaceHeaders = { ...responseHeaders, ...userLimit.headers };

    if (!userLimit.allowed) {
      safeLogWarn('checkout.marketplace.rate_limited', {
        requestId,
        ip,
        userId: authenticatedUser.id,
      });
      return errorWithRequestId(429, 'Too many purchase attempts. Please retry shortly.', marketplaceHeaders);
    }

    const listingIdResult = requireUuid(body.listingId, 'listingId');
    if (!listingIdResult.ok) {
      return errorWithRequestId(400, listingIdResult.error, marketplaceHeaders);
    }

    try {
      const listing = await resolveMarketplaceListingContext(listingIdResult.value);
      if (!listing) {
        return errorWithRequestId(404, 'Marketplace listing not found.', marketplaceHeaders);
      }

      if (!listing.isPublic || listing.generationStatus !== 'completed') {
        return errorWithRequestId(400, 'Listing is not available for purchase.', marketplaceHeaders);
      }

      if (listing.priceCents < 99 || listing.priceCents > 100000) {
        return errorWithRequestId(400, 'Listing price is out of allowed range.', marketplaceHeaders);
      }

      if (listing.sellerUserId === authenticatedUser.id) {
        return errorWithRequestId(403, 'You cannot purchase your own listing.', marketplaceHeaders);
      }

      const safePrompt = sanitizeProductSnippet(listing.prompt, 120);
      const safeUsageRights = sanitizeProductSnippet(listing.usageRights, 200);

      const metadata: Record<string, string> = {
        checkout_type: 'marketplace',
        listing_id: listing.listingId,
        generation_id: listing.generationId,
        seller_user_id: listing.sellerUserId,
        buyer_user_id: authenticatedUser.id,
        license_type: listing.licenseType,
      };

      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        line_items: [
          {
            price_data: {
              currency: 'usd',
              unit_amount: listing.priceCents,
              product_data: {
                name: 'MusicForge Track License',
                description: `${safePrompt} | ${listing.licenseType} license | ${safeUsageRights}`,
              },
            },
            quantity: 1,
          },
        ],
        success_url: successUrlResult.value,
        cancel_url: cancelUrlResult.value,
        customer_email: authenticatedUser.email ?? undefined,
        client_reference_id: authenticatedUser.id,
        metadata,
        payment_intent_data: {
          metadata,
        },
        allow_promotion_codes: true,
      });

      const url = normalizeString(session.url);
      if (!url) {
        return errorWithRequestId(500, 'Stripe did not return a checkout URL.', marketplaceHeaders);
      }

      safeLogInfo('checkout.marketplace.created', {
        requestId,
        listingId: listing.listingId,
        generationId: listing.generationId,
        buyerUserId: authenticatedUser.id,
        sellerUserId: listing.sellerUserId,
        amountCents: listing.priceCents,
      });

      return jsonResponse({ url }, 200, marketplaceHeaders);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create marketplace checkout session.';
      safeLogWarn('checkout.marketplace.failed', { requestId, ip, reason: message });
      return errorWithRequestId(500, 'Failed to create marketplace checkout session.', responseHeaders);
    }
  }

  const tierResult = requireEnum(body.tier, SUPPORTED_TIERS, 'tier');
  if (!tierResult.ok) {
    safeLogWarn('checkout.invalid_payload', { requestId, reason: 'tier', ip });
    return errorWithRequestId(400, tierResult.error, responseHeaders);
  }
  const tier = tierResult.value;

  const priceId = resolvePriceIdForTier(tier);
  if (!priceId) {
    return errorWithRequestId(
      500,
      `No Stripe price is configured for tier "${tier}".`,
      responseHeaders,
    );
  }

  try {
    const payloadEmail = normalizeString(body.email)?.toLowerCase();

    const safeUserId = sanitizeMetadataValue(authenticatedUser?.id ?? null);
    const safeEmail = sanitizeMetadataValue(authenticatedUser?.email ?? payloadEmail ?? null);
    const metadata: Record<string, string> = {
      tier,
      ...(safeUserId ? { userId: safeUserId } : {}),
      ...(safeEmail ? { email: safeEmail } : {}),
    };

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrlResult.value,
      cancel_url: cancelUrlResult.value,
      customer_email: safeEmail ?? undefined,
      metadata,
      subscription_data: {
        metadata,
      },
      allow_promotion_codes: true,
    });

    const url = normalizeString(session.url);
    if (!url) {
      return errorWithRequestId(500, 'Stripe did not return a checkout URL.', responseHeaders);
    }

    safeLogInfo('checkout.created', {
      requestId,
      checkoutType,
      tier,
      ip,
      hasUserId: Boolean(safeUserId),
    });

    return jsonResponse({ url }, 200, responseHeaders);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create checkout session.';
    safeLogWarn('checkout.failed', { requestId, checkoutType, ip, reason: message });
    return errorWithRequestId(500, 'Failed to create checkout session.', responseHeaders);
  }
});