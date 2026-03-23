import type { SubscriptionTier } from '../types/billing';
import { getErrorMessage } from '../utils/errors';
import { getSupabase } from './client';

export type SubscriptionProfileRecord = {
  id: string;
  subscription_tier: SubscriptionTier;
  subscription_status: string | null;
  subscription_expires_at: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  billing_updated_at: string | null;
};

export type SubscriptionProfilePatch = Partial<
  Pick<
    SubscriptionProfileRecord,
    | 'subscription_tier'
    | 'subscription_status'
    | 'subscription_expires_at'
    | 'stripe_customer_id'
    | 'stripe_subscription_id'
    | 'billing_updated_at'
  >
>;

const SUBSCRIPTION_COLUMNS =
  'id, subscription_tier, subscription_status, subscription_expires_at, stripe_customer_id, stripe_subscription_id, billing_updated_at';

const SUPABASE_CONFIG_ERROR = 'Supabase not configured';

function requireSupabase() {
  const supabase = getSupabase();
  if (!supabase) throw new Error(SUPABASE_CONFIG_ERROR);
  return supabase;
}

function normalizeString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeTier(value: unknown): SubscriptionTier | null {
  const normalized = normalizeString(value)?.toLowerCase();
  if (normalized === 'free' || normalized === 'pro' || normalized === 'studio') return normalized;
  return null;
}

function normalizeIsoDate(value: unknown): string | null {
  const normalized = normalizeString(value);
  if (!normalized) return null;
  const timestamp = new Date(normalized).getTime();
  if (!Number.isFinite(timestamp)) return null;
  return new Date(timestamp).toISOString();
}

function normalizePatch(patch: SubscriptionProfilePatch): Record<string, unknown> {
  const updatePayload: Record<string, unknown> = {
    billing_updated_at: new Date().toISOString(),
  };

  if (patch.subscription_tier !== undefined) {
    updatePayload.subscription_tier = normalizeTier(patch.subscription_tier) ?? 'free';
  }
  if (patch.subscription_status !== undefined) {
    updatePayload.subscription_status = normalizeString(patch.subscription_status);
  }
  if (patch.subscription_expires_at !== undefined) {
    updatePayload.subscription_expires_at = normalizeIsoDate(patch.subscription_expires_at);
  }
  if (patch.stripe_customer_id !== undefined) {
    updatePayload.stripe_customer_id = normalizeString(patch.stripe_customer_id);
  }
  if (patch.stripe_subscription_id !== undefined) {
    updatePayload.stripe_subscription_id = normalizeString(patch.stripe_subscription_id);
  }
  if (patch.billing_updated_at !== undefined) {
    updatePayload.billing_updated_at = normalizeIsoDate(patch.billing_updated_at) ?? new Date().toISOString();
  }

  return updatePayload;
}

function normalizeRecord(data: unknown): SubscriptionProfileRecord | null {
  if (!data || typeof data !== 'object') return null;
  const row = data as Record<string, unknown>;
  const id = normalizeString(row.id);
  const tier = normalizeTier(row.subscription_tier) ?? 'free';

  if (!id) return null;

  return {
    id,
    subscription_tier: tier,
    subscription_status: normalizeString(row.subscription_status),
    subscription_expires_at: normalizeIsoDate(row.subscription_expires_at),
    stripe_customer_id: normalizeString(row.stripe_customer_id),
    stripe_subscription_id: normalizeString(row.stripe_subscription_id),
    billing_updated_at: normalizeIsoDate(row.billing_updated_at),
  };
}

export async function getUserSubscriptionByUserId(userId: string): Promise<SubscriptionProfileRecord | null> {
  const supabase = requireSupabase();
  const normalizedUserId = normalizeString(userId);
  if (!normalizedUserId) {
    throw new Error('User id is required.');
  }

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select(SUBSCRIPTION_COLUMNS)
      .eq('id', normalizedUserId)
      .maybeSingle();

    if (error) {
      throw new Error(getErrorMessage(error, 'Failed to fetch user subscription.'));
    }

    return normalizeRecord(data);
  } catch (err) {
    throw new Error(getErrorMessage(err, 'Failed to fetch user subscription.'));
  }
}

export async function updateUserSubscriptionByUserId(
  userId: string,
  patch: SubscriptionProfilePatch,
): Promise<SubscriptionProfileRecord> {
  const supabase = requireSupabase();
  const normalizedUserId = normalizeString(userId);
  if (!normalizedUserId) {
    throw new Error('User id is required.');
  }

  const updatePayload = normalizePatch(patch);

  try {
    const { data, error } = await supabase
      .from('profiles')
      .update(updatePayload)
      .eq('id', normalizedUserId)
      .select(SUBSCRIPTION_COLUMNS)
      .single();

    if (error) {
      throw new Error(getErrorMessage(error, 'Failed to update user subscription.'));
    }

    const normalized = normalizeRecord(data);
    if (!normalized) {
      throw new Error('Failed to normalize updated subscription data.');
    }
    return normalized;
  } catch (err) {
    throw new Error(getErrorMessage(err, 'Failed to update user subscription.'));
  }
}

export async function updateUserSubscriptionByStripeCustomerId(
  customerId: string,
  patch: SubscriptionProfilePatch,
): Promise<SubscriptionProfileRecord> {
  const supabase = requireSupabase();
  const normalizedCustomerId = normalizeString(customerId);
  if (!normalizedCustomerId) {
    throw new Error('Stripe customer id is required.');
  }

  const updatePayload = normalizePatch(patch);

  try {
    const { data, error } = await supabase
      .from('profiles')
      .update(updatePayload)
      .eq('stripe_customer_id', normalizedCustomerId)
      .select(SUBSCRIPTION_COLUMNS)
      .single();

    if (error) {
      throw new Error(getErrorMessage(error, 'Failed to update subscription by Stripe customer id.'));
    }

    const normalized = normalizeRecord(data);
    if (!normalized) {
      throw new Error('Failed to normalize updated subscription data.');
    }
    return normalized;
  } catch (err) {
    throw new Error(getErrorMessage(err, 'Failed to update subscription by Stripe customer id.'));
  }
}

export async function linkStripeCustomerToUser(
  userId: string,
  stripeCustomerId: string,
): Promise<SubscriptionProfileRecord> {
  const normalizedCustomerId = normalizeString(stripeCustomerId);
  if (!normalizedCustomerId) {
    throw new Error('Stripe customer id is required.');
  }

  return updateUserSubscriptionByUserId(userId, {
    stripe_customer_id: normalizedCustomerId,
  });
}
