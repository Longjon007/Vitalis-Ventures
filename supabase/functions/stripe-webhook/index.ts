// Supabase Edge Function: Stripe Webhook
// Persists subscription state changes and marketplace sales from Stripe events.
//
// Deploy: supabase functions deploy stripe-webhook --no-verify-jwt
// Set secrets:
//   STRIPE_SECRET_KEY=sk_live_...
//   STRIPE_WEBHOOK_SECRET=whsec_...
//   STRIPE_PRICE_STARTER_ID=price_...
//   STRIPE_PRICE_PRO_ID=price_...
//   STRIPE_PRICE_STUDIO_ID=price_...
//   SUPABASE_URL=...
//   SUPABASE_SERVICE_ROLE_KEY=...

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14.25.0?target=denonext';
import {
  getOrCreateRequestId,
  safeLogInfo,
  safeLogWarn,
  withRequestIdDetails,
  withRequestIdHeader,
} from '../_shared/validation.ts';

type SubscriptionTier = 'free' | 'pro' | 'studio';
type SupportedStripeEventType =
  | 'checkout.session.completed'
  | 'customer.subscription.updated'
  | 'customer.subscription.deleted';

type SubscriptionPatch = {
  subscription_tier?: SubscriptionTier;
  subscription_status?: string | null;
  subscription_expires_at?: string | null;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  billing_updated_at?: string;
};

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY') ?? '';
const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '';
const STRIPE_PRICE_STARTER_ID = Deno.env.get('STRIPE_PRICE_STARTER_ID') ?? '';
const STRIPE_PRICE_PRO_ID = Deno.env.get('STRIPE_PRICE_PRO_ID') ?? '';
const STRIPE_PRICE_STUDIO_ID = Deno.env.get('STRIPE_PRICE_STUDIO_ID') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const REQUIRED_ENV_MISSING =
  !STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY;

const stripe = REQUIRED_ENV_MISSING
  ? null
  : new Stripe(STRIPE_SECRET_KEY, {
      apiVersion: '2023-10-16',
    });

const cryptoProvider = Stripe.createSubtleCryptoProvider();

const supabase = REQUIRED_ENV_MISSING
  ? null
  : createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

function normalizeString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeTier(value: unknown): SubscriptionTier | null {
  const normalized = normalizeString(value)?.toLowerCase();
  if (normalized === 'starter') return 'pro';
  if (normalized === 'free' || normalized === 'pro' || normalized === 'studio') return normalized;
  return null;
}

function mapStatus(value: unknown): string | null {
  const normalized = normalizeString(value)?.toLowerCase();
  return normalized ?? null;
}

function toIsoFromUnix(value: number | null | undefined): string | null {
  if (typeof value !== 'number' || Number.isNaN(value) || !Number.isFinite(value) || value <= 0) {
    return null;
  }
  return new Date(value * 1000).toISOString();
}

function mapPriceIdToTier(priceId: string | null): SubscriptionTier {
  if (!priceId) return 'free';
  if (STRIPE_PRICE_STARTER_ID && priceId === STRIPE_PRICE_STARTER_ID) return 'pro';
  if (STRIPE_PRICE_PRO_ID && priceId === STRIPE_PRICE_PRO_ID) return 'pro';
  if (STRIPE_PRICE_STUDIO_ID && priceId === STRIPE_PRICE_STUDIO_ID) return 'studio';
  return 'free';
}

function getCustomerId(
  customer: string | Stripe.Customer | Stripe.DeletedCustomer | null,
): string | null {
  if (typeof customer === 'string') return normalizeString(customer);
  if (!customer || typeof customer !== 'object') return null;
  return normalizeString(customer.id);
}

function getTierFromSubscription(
  subscription: Stripe.Subscription,
  fallbackTier: SubscriptionTier = 'free',
): SubscriptionTier {
  const metadataTier = normalizeTier(subscription.metadata?.tier);
  if (metadataTier) return metadataTier;

  const price = subscription.items.data[0]?.price;
  const priceMetadataTier = normalizeTier(price?.metadata?.tier);
  if (priceMetadataTier) return priceMetadataTier;

  const lookupTier = normalizeTier(price?.lookup_key);
  if (lookupTier) return lookupTier;

  const nicknameTier = normalizeTier(price?.nickname);
  if (nicknameTier) return nicknameTier;

  const mappedPriceTier = mapPriceIdToTier(normalizeString(price?.id));
  if (mappedPriceTier !== 'free') return mappedPriceTier;

  return fallbackTier;
}

function buildPatchFromSubscription(
  subscription: Stripe.Subscription,
  fallbackTier: SubscriptionTier = 'free',
): SubscriptionPatch {
  return {
    subscription_tier: getTierFromSubscription(subscription, fallbackTier),
    subscription_status: mapStatus(subscription.status),
    subscription_expires_at: toIsoFromUnix(subscription.current_period_end),
    stripe_customer_id: getCustomerId(subscription.customer),
    stripe_subscription_id: normalizeString(subscription.id),
    billing_updated_at: new Date().toISOString(),
  };
}

function buildPatchFromDeletedSubscription(subscription: Stripe.Subscription): SubscriptionPatch {
  return {
    subscription_tier: 'free',
    subscription_status: 'canceled',
    subscription_expires_at: toIsoFromUnix(subscription.canceled_at ?? subscription.current_period_end),
    stripe_customer_id: getCustomerId(subscription.customer),
    stripe_subscription_id: normalizeString(subscription.id),
    billing_updated_at: new Date().toISOString(),
  };
}

function normalizeRpcResult(value: unknown): Record<string, unknown> {
  if (Array.isArray(value)) {
    const first = value[0];
    if (first && typeof first === 'object') {
      return first as Record<string, unknown>;
    }
    return {};
  }
  if (value && typeof value === 'object') {
    return value as Record<string, unknown>;
  }
  return {};
}

function getPaymentIntentId(
  paymentIntent: string | Stripe.PaymentIntent | null,
): string | null {
  if (typeof paymentIntent === 'string') return normalizeString(paymentIntent);
  if (!paymentIntent || typeof paymentIntent !== 'object') return null;
  return normalizeString(paymentIntent.id);
}

async function recordMarketplaceSale(session: Stripe.Checkout.Session): Promise<Record<string, unknown>> {
  if (!supabase) {
    throw new Error('Supabase service client is not configured.');
  }

  const listingId = normalizeString(session.metadata?.listing_id);
  const paymentIntentId = getPaymentIntentId(session.payment_intent as string | Stripe.PaymentIntent | null);
  const buyerUserId =
    normalizeString(session.metadata?.buyer_user_id) ?? normalizeString(session.client_reference_id);

  if (!listingId) {
    throw new Error('Marketplace webhook payload missing listing_id metadata.');
  }
  if (!paymentIntentId) {
    throw new Error('Marketplace webhook payload missing payment_intent id.');
  }

  const paymentStatus = normalizeString(session.payment_status)?.toLowerCase();
  const status = paymentStatus === 'paid' ? 'completed' : 'pending';

  const { data, error } = await supabase.rpc('record_marketplace_sale', {
    p_listing_id: listingId,
    p_stripe_payment_intent_id: paymentIntentId,
    p_buyer_user_id: buyerUserId,
    p_status: status,
  });

  if (error) {
    throw new Error(error.message || 'Failed to record marketplace sale.');
  }

  const result = normalizeRpcResult(data);
  if (result.success !== true) {
    throw new Error(normalizeString(result.error) ?? 'Marketplace sale recording RPC returned unsuccessful result.');
  }

  return {
    ok: true,
    handled: true,
    flow: 'marketplace',
    listingId,
    paymentIntentId,
    saleId: normalizeString(result.sale_id),
    status,
  };
}

async function updateByUserId(userId: string, patch: SubscriptionPatch): Promise<string> {
  if (!supabase) throw new Error('Supabase service client is not configured.');

  const { data, error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('id', userId)
    .select('id')
    .maybeSingle();

  if (error) throw new Error(error.message || 'Failed to update profile by user id.');
  if (!data?.id) throw new Error('No profile found for provided user id.');
  return data.id as string;
}

async function updateByCustomerId(customerId: string, patch: SubscriptionPatch): Promise<string> {
  if (!supabase) throw new Error('Supabase service client is not configured.');

  const { data, error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('stripe_customer_id', customerId)
    .select('id')
    .maybeSingle();

  if (error) throw new Error(error.message || 'Failed to update profile by Stripe customer id.');
  if (!data?.id) throw new Error('No profile found for provided Stripe customer id.');
  return data.id as string;
}

async function linkStripeCustomer(userId: string, customerId: string): Promise<void> {
  if (!supabase) throw new Error('Supabase service client is not configured.');

  const { error } = await supabase
    .from('profiles')
    .update({
      stripe_customer_id: customerId,
      billing_updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (error) throw new Error(error.message || 'Failed to link Stripe customer id.');
}

async function persistSubscriptionPatch(args: {
  userId: string | null;
  customerId: string | null;
  patch: SubscriptionPatch;
}): Promise<string> {
  const { userId, customerId, patch } = args;

  if (userId) {
    if (customerId) {
      await linkStripeCustomer(userId, customerId);
    }
    return updateByUserId(userId, patch);
  }

  if (customerId) {
    return updateByCustomerId(customerId, patch);
  }

  throw new Error('Webhook payload did not include a resolvable user or customer identifier.');
}

function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
  headers: HeadersInit = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
}

async function processCheckoutCompleted(event: Stripe.Event): Promise<Record<string, unknown>> {
  if (!stripe) throw new Error('Stripe client is not configured.');

  const session = event.data.object as Stripe.Checkout.Session;
  const checkoutType = normalizeString(session.metadata?.checkout_type)?.toLowerCase();

  if (checkoutType === 'marketplace' || session.mode === 'payment') {
    const marketplaceResult = await recordMarketplaceSale(session);
    return {
      ...marketplaceResult,
      eventType: event.type,
      checkoutSessionId: normalizeString(session.id),
    };
  }

  const userId = normalizeString(session.metadata?.userId) ?? normalizeString(session.client_reference_id);
  const customerId = getCustomerId(session.customer as string | Stripe.Customer | Stripe.DeletedCustomer | null);
  const sessionTier = normalizeTier(session.metadata?.tier) ?? 'pro';
  const subscriptionId =
    typeof session.subscription === 'string'
      ? normalizeString(session.subscription)
      : normalizeString(session.subscription?.id);

  let patch: SubscriptionPatch = {
    subscription_tier: sessionTier,
    subscription_status: 'active',
    subscription_expires_at: null,
    stripe_customer_id: customerId,
    stripe_subscription_id: subscriptionId,
    billing_updated_at: new Date().toISOString(),
  };

  if (subscriptionId) {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
      expand: ['items.data.price'],
    });
    patch = buildPatchFromSubscription(subscription, sessionTier);
  }

  const resolvedUserId = await persistSubscriptionPatch({
    userId,
    customerId,
    patch,
  });

  return {
    ok: true,
    handled: true,
    flow: 'subscription',
    eventType: event.type,
    userId: resolvedUserId,
    stripeCustomerId: customerId,
    stripeSubscriptionId: patch.stripe_subscription_id ?? null,
  };
}

async function processSubscriptionUpdated(event: Stripe.Event): Promise<Record<string, unknown>> {
  const subscription = event.data.object as Stripe.Subscription;
  const customerId = getCustomerId(subscription.customer);
  const userId = normalizeString(subscription.metadata?.userId);
  const patch = buildPatchFromSubscription(subscription, 'pro');

  const resolvedUserId = await persistSubscriptionPatch({
    userId,
    customerId,
    patch,
  });

  return {
    ok: true,
    handled: true,
    eventType: event.type,
    userId: resolvedUserId,
    stripeCustomerId: customerId,
    stripeSubscriptionId: patch.stripe_subscription_id ?? null,
  };
}

async function processSubscriptionDeleted(event: Stripe.Event): Promise<Record<string, unknown>> {
  const subscription = event.data.object as Stripe.Subscription;
  const customerId = getCustomerId(subscription.customer);
  const userId = normalizeString(subscription.metadata?.userId);
  const patch = buildPatchFromDeletedSubscription(subscription);

  const resolvedUserId = await persistSubscriptionPatch({
    userId,
    customerId,
    patch,
  });

  return {
    ok: true,
    handled: true,
    eventType: event.type,
    userId: resolvedUserId,
    stripeCustomerId: customerId,
    stripeSubscriptionId: patch.stripe_subscription_id ?? null,
  };
}

Deno.serve(async (req: Request) => {
  const requestId = getOrCreateRequestId(req);
  const responseHeaders = withRequestIdHeader({}, requestId);
  const errorWithRequestId = (
    status: number,
    message: string,
    details?: Record<string, unknown>,
  ) => jsonResponse(
    {
      ok: false,
      error: message,
      details: withRequestIdDetails(requestId, details),
    },
    status,
    responseHeaders,
  );

  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: withRequestIdHeader({
        Allow: 'POST, OPTIONS',
      }, requestId),
    });
  }

  if (req.method !== 'POST') {
    return jsonResponse(
      {
        ok: false,
        error: 'Method not allowed.',
        details: withRequestIdDetails(requestId),
      },
      405,
      withRequestIdHeader({ Allow: 'POST, OPTIONS' }, requestId),
    );
  }

  if (REQUIRED_ENV_MISSING || !stripe || !supabase) {
    return errorWithRequestId(
      500,
      'Stripe webhook is not configured. Required: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.',
    );
  }

  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    safeLogWarn('stripe_webhook.missing_signature', { requestId });
    return errorWithRequestId(400, 'Missing stripe-signature header.');
  }

  const rawBody = await req.text();
  let event: Stripe.Event;

  try {
    event = await stripe.webhooks.constructEventAsync(
      rawBody,
      signature,
      STRIPE_WEBHOOK_SECRET,
      undefined,
      cryptoProvider,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Webhook signature verification failed.';
    safeLogWarn('stripe_webhook.signature_failed', { requestId, reason: message });
    return errorWithRequestId(400, 'Invalid Stripe webhook signature.');
  }

  try {
    const supportedType = event.type as SupportedStripeEventType;

    if (supportedType === 'checkout.session.completed') {
      const result = await processCheckoutCompleted(event);
      safeLogInfo('stripe_webhook.handled', {
        requestId,
        eventType: event.type,
        flow: normalizeString(result.flow) ?? 'unknown',
      });
      return jsonResponse(result, 200, responseHeaders);
    }
    if (supportedType === 'customer.subscription.updated') {
      const result = await processSubscriptionUpdated(event);
      safeLogInfo('stripe_webhook.handled', { requestId, eventType: event.type });
      return jsonResponse(result, 200, responseHeaders);
    }
    if (supportedType === 'customer.subscription.deleted') {
      const result = await processSubscriptionDeleted(event);
      safeLogInfo('stripe_webhook.handled', { requestId, eventType: event.type });
      return jsonResponse(result, 200, responseHeaders);
    }

    safeLogInfo('stripe_webhook.ignored_event', { requestId, eventType: event.type });
    return jsonResponse(
      {
        ok: true,
        handled: false,
        eventType: event.type,
        message: 'Ignored unsupported Stripe event.',
      },
      200,
      responseHeaders,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Webhook processing failed.';
    safeLogWarn('stripe_webhook.processing_failed', { requestId, reason: message });
    return errorWithRequestId(500, 'Webhook processing failed.');
  }
});