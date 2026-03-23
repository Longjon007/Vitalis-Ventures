import type { SubscriptionTier } from '../types/billing';

export type PlanCredits = {
  label: string;
  monthlyCredits: number;
  aiMaxDurationSeconds: number;
};

export const PLAN_CREDITS: Record<SubscriptionTier, PlanCredits> = {
  free: {
    label: 'Free',
    monthlyCredits: 50,
    aiMaxDurationSeconds: 15,
  },
  pro: {
    label: 'Pro',
    monthlyCredits: 500,
    aiMaxDurationSeconds: 120,
  },
  studio: {
    label: 'Studio',
    monthlyCredits: 2000,
    aiMaxDurationSeconds: 300,
  },
};

export function getPlanCredits(tier: string): PlanCredits {
  if (tier === 'pro' || tier === 'studio' || tier === 'free') {
    return PLAN_CREDITS[tier];
  }
  return PLAN_CREDITS.free;
}
