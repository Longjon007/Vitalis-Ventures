export type SubscriptionTier = 'free' | 'pro' | 'studio';
export type PaidSubscriptionTier = Exclude<SubscriptionTier, 'free'>;

export type BillingActionState = 'idle' | 'pending' | 'error';
export type SubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'unpaid'
  | 'incomplete'
  | 'incomplete_expired'
  | 'paused'
  | string;

export interface StripeCheckoutRequest {
  tier: PaidSubscriptionTier;
  successUrl: string;
  cancelUrl: string;
  userId?: string;
  email?: string;
  metadata?: Record<string, string>;
}

export interface StripeMarketplaceCheckoutRequest {
  checkoutType: 'marketplace';
  listingId: string;
  successUrl: string;
  cancelUrl: string;
}

export interface StripePortalRequest {
  returnUrl: string;
  userId?: string;
}

export interface StripeUrlResponse {
  url: string;
}
