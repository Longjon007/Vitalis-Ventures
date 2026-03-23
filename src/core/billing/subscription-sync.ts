import { getUserSubscriptionByUserId } from '../supabase/subscriptions';
import type { SubscriptionStatus, SubscriptionTier } from '../types/billing';
import { getErrorMessage } from '../utils/errors';

export interface SubscriptionSnapshot {
  tier: SubscriptionTier;
  status: SubscriptionStatus | null;
  expiresAt: number | null;
}

function normalizeTier(value: string | null | undefined): SubscriptionTier {
  if (value === 'pro' || value === 'studio' || value === 'free') return value;
  return 'free';
}

function normalizeStatus(value: string | null | undefined): SubscriptionStatus | null {
  if (!value || typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  return normalized;
}

function normalizeExpiry(value: string | null | undefined): number | null {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

export async function fetchSubscriptionSnapshot(userId: string): Promise<SubscriptionSnapshot | null> {
  try {
    const profile = await getUserSubscriptionByUserId(userId);
    if (!profile) return null;

    return {
      tier: normalizeTier(profile.subscription_tier),
      status: normalizeStatus(profile.subscription_status),
      expiresAt: normalizeExpiry(profile.subscription_expires_at),
    };
  } catch (err) {
    throw new Error(getErrorMessage(err, 'Unable to fetch subscription data.'));
  }
}
