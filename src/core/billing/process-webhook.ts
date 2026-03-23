import type { SubscriptionTier } from '../types/billing';
import type { PersistedSubscriptionState } from './webhook-contract';
import { getErrorMessage } from '../utils/errors';

export interface StripePlanMapping {
  starterPriceId?: string | null;
  proPriceId?: string | null;
  studioPriceId?: string | null;
}

export interface StripeLikePrice {
  id?: string | null;
  lookup_key?: string | null;
  nickname?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface StripeLikeSubscriptionItem {
  price?: StripeLikePrice | null;
}

export interface StripeLikeSubscription {
  id?: string | null;
  customer?: string | { id?: string | null } | null;
  status?: string | null;
  current_period_end?: number | null;
  cancel_at?: number | null;
  canceled_at?: number | null;
  metadata?: Record<string, unknown> | null;
  items?: {
    data?: StripeLikeSubscriptionItem[] | null;
  } | null;
}

export interface StripeLikeCheckoutSession {
  customer?: string | { id?: string | null } | null;
  subscription?: string | StripeLikeSubscription | null;
  metadata?: Record<string, unknown> | null;
  client_reference_id?: string | null;
  customer_details?: {
    email?: string | null;
  } | null;
}

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

function normalizeTimestamp(value: number | null | undefined): string | null {
  if (typeof value !== 'number' || Number.isNaN(value) || !Number.isFinite(value) || value <= 0) {
    return null;
  }
  return new Date(value * 1000).toISOString();
}

function normalizeCustomerId(customer: StripeLikeSubscription['customer']): string | null {
  if (typeof customer === 'string') return normalizeString(customer);
  if (customer && typeof customer === 'object') return normalizeString(customer.id);
  return null;
}

function normalizeSubscriptionId(subscription: StripeLikeCheckoutSession['subscription']): string | null {
  if (typeof subscription === 'string') return normalizeString(subscription);
  if (subscription && typeof subscription === 'object') return normalizeString(subscription.id);
  return null;
}

function getPriceFromSubscription(subscription: StripeLikeSubscription): StripeLikePrice | null {
  const firstItem = subscription.items?.data?.[0];
  if (!firstItem || typeof firstItem !== 'object') return null;
  const price = firstItem.price;
  if (!price || typeof price !== 'object') return null;
  return price;
}

export function mapStripePriceIdToPlan(
  priceId: string | null | undefined,
  mapping: StripePlanMapping = {},
): SubscriptionTier {
  const normalizedPriceId = normalizeString(priceId);
  if (!normalizedPriceId) return 'free';

  if (mapping.starterPriceId && normalizedPriceId === mapping.starterPriceId) return 'pro';
  if (mapping.proPriceId && normalizedPriceId === mapping.proPriceId) return 'pro';
  if (mapping.studioPriceId && normalizedPriceId === mapping.studioPriceId) return 'studio';
  return 'free';
}

export function mapSubscriptionStatus(status: unknown): string | null {
  const normalized = normalizeString(status)?.toLowerCase();
  if (!normalized) return null;

  const supported = new Set([
    'trialing',
    'active',
    'past_due',
    'canceled',
    'unpaid',
    'incomplete',
    'incomplete_expired',
    'paused',
  ]);

  if (supported.has(normalized)) return normalized;
  return normalized;
}

function resolveTierFromSubscription(
  subscription: StripeLikeSubscription,
  mapping: StripePlanMapping,
  fallbackTier: SubscriptionTier = 'free',
): SubscriptionTier {
  const metadataTier = normalizeTier(subscription.metadata?.tier);
  if (metadataTier) return metadataTier;

  const price = getPriceFromSubscription(subscription);
  const priceMetadataTier = normalizeTier(price?.metadata?.tier);
  if (priceMetadataTier) return priceMetadataTier;

  const priceLookupTier = normalizeTier(price?.lookup_key);
  if (priceLookupTier) return priceLookupTier;

  const priceNicknameTier = normalizeTier(price?.nickname);
  if (priceNicknameTier) return priceNicknameTier;

  const priceIdTier = mapStripePriceIdToPlan(price?.id, mapping);
  if (priceIdTier !== 'free') return priceIdTier;

  return fallbackTier;
}

export function buildStateFromSubscription(
  subscription: StripeLikeSubscription,
  options: {
    mapping?: StripePlanMapping;
    fallbackTier?: SubscriptionTier;
    userId?: string | null;
  } = {},
): PersistedSubscriptionState {
  const mapping = options.mapping ?? {};
  const fallbackTier = options.fallbackTier ?? 'free';

  const tier = resolveTierFromSubscription(subscription, mapping, fallbackTier);
  const expiry = normalizeTimestamp(subscription.current_period_end ?? subscription.cancel_at ?? null);

  return {
    userId: options.userId ?? normalizeString(subscription.metadata?.userId) ?? null,
    tier,
    subscriptionStatus: mapSubscriptionStatus(subscription.status),
    subscriptionExpiresAt: expiry,
    stripeCustomerId: normalizeCustomerId(subscription.customer),
    stripeSubscriptionId: normalizeString(subscription.id),
    billingUpdatedAt: new Date().toISOString(),
  };
}

export function buildStateFromCheckoutSession(
  session: StripeLikeCheckoutSession,
  options: {
    mapping?: StripePlanMapping;
    resolvedSubscription?: StripeLikeSubscription | null;
  } = {},
): PersistedSubscriptionState {
  const metadataTier = normalizeTier(session.metadata?.tier);
  const metadataUserId = normalizeString(session.metadata?.userId);
  const sessionSubscription = session.subscription;

  if (options.resolvedSubscription) {
    return buildStateFromSubscription(options.resolvedSubscription, {
      mapping: options.mapping,
      fallbackTier: metadataTier ?? 'pro',
      userId: metadataUserId ?? normalizeString(options.resolvedSubscription.metadata?.userId) ?? null,
    });
  }

  const fallbackTier = metadataTier ?? 'pro';
  const sessionSubscriptionId = normalizeSubscriptionId(sessionSubscription);

  return {
    userId: metadataUserId ?? normalizeString(session.client_reference_id) ?? null,
    tier: fallbackTier,
    subscriptionStatus: 'active',
    subscriptionExpiresAt: null,
    stripeCustomerId: normalizeCustomerId(session.customer),
    stripeSubscriptionId: sessionSubscriptionId,
    billingUpdatedAt: new Date().toISOString(),
  };
}

export function buildStateForDeletedSubscription(
  subscription: StripeLikeSubscription,
): PersistedSubscriptionState {
  return {
    userId: normalizeString(subscription.metadata?.userId) ?? null,
    tier: 'free',
    subscriptionStatus: 'canceled',
    subscriptionExpiresAt: normalizeTimestamp(subscription.canceled_at ?? subscription.current_period_end ?? null),
    stripeCustomerId: normalizeCustomerId(subscription.customer),
    stripeSubscriptionId: normalizeString(subscription.id),
    billingUpdatedAt: new Date().toISOString(),
  };
}

export function normalizeWebhookError(err: unknown): string {
  return getErrorMessage(err, 'Webhook processing failed.');
}
