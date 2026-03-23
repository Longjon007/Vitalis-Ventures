import type { SubscriptionTier } from '../types/billing';

export type StripeWebhookEventType =
  | 'checkout.session.completed'
  | 'customer.subscription.updated'
  | 'customer.subscription.deleted';

export const SUPPORTED_STRIPE_WEBHOOK_EVENTS: readonly StripeWebhookEventType[] = [
  'checkout.session.completed',
  'customer.subscription.updated',
  'customer.subscription.deleted',
];

export interface PersistedSubscriptionState {
  userId?: string | null;
  tier: SubscriptionTier;
  subscriptionStatus: string | null;
  subscriptionExpiresAt: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  billingUpdatedAt: string;
}

export interface WebhookProcessingResult {
  ok: boolean;
  handled: boolean;
  eventType: StripeWebhookEventType | 'unsupported';
  userId: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  message: string;
  error?: string;
}
