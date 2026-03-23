import { env, hasStripeBillingConfig, hasStripeCheckoutConfig, hasStripePortalConfig } from '../config/env';
import { getSupabase } from '../supabase/client';
import type {
  PaidSubscriptionTier,
  StripeCheckoutRequest,
  StripeMarketplaceCheckoutRequest,
  StripePortalRequest,
  StripeUrlResponse,
} from '../types/billing';
import { getErrorMessage } from '../utils/errors';
import { trackEvent } from '../analytics/tracker';

const CHECKOUT_CONFIG_ERROR = 'Checkout is not configured yet.';
const PORTAL_CONFIG_ERROR = 'Billing portal is not configured yet.';

function toAbsoluteUrl(pathOrUrl: string): string {
  return new URL(pathOrUrl, env.appBaseUrl).toString();
}

function isValidRedirectUrl(url: unknown): url is string {
  return typeof url === 'string' && /^https?:\/\//i.test(url);
}

type CheckoutMetadataContext = {
  userId?: string;
  email?: string;
};

async function getCheckoutMetadataContext(): Promise<CheckoutMetadataContext> {
  const supabase = getSupabase();
  if (!supabase) return {};

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return {};
    return {
      userId: user.id,
      email: typeof user.email === 'string' ? user.email : undefined,
    };
  } catch {
    return {};
  }
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const baseHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const supabase = getSupabase();
  if (!supabase) return baseHeaders;

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session?.access_token) {
    baseHeaders.Authorization = `Bearer ${session.access_token}`;
  }

  return baseHeaders;
}

async function postForRedirectUrl(
  endpoint: string,
  payload: unknown,
): Promise<string> {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify(payload),
  });

  let parsed: StripeUrlResponse | Record<string, unknown> | null = null;
  try {
    parsed = (await response.json()) as StripeUrlResponse | Record<string, unknown>;
  } catch {
    parsed = null;
  }

  if (!response.ok) {
    const errorText = parsed && typeof parsed === 'object' ? parsed : response.statusText;
    throw new Error(getErrorMessage(errorText, 'Billing request failed.'));
  }

  const url = parsed && typeof parsed === 'object' ? (parsed as StripeUrlResponse).url : null;
  if (!isValidRedirectUrl(url)) {
    throw new Error('Billing service returned an invalid redirect URL.');
  }

  return url;
}

export function getBillingConfigStatus() {
  return {
    hasStripePublishableKey: Boolean(env.stripePublishableKey),
    hasCheckoutEndpoint: hasStripeCheckoutConfig(),
    hasPortalEndpoint: hasStripePortalConfig(),
    isBillingConfigured: hasStripeBillingConfig(),
  };
}

export async function createCheckoutUrl(tier: PaidSubscriptionTier): Promise<string> {
  if (!hasStripeCheckoutConfig() || !env.stripeCheckoutEndpoint) {
    throw new Error(CHECKOUT_CONFIG_ERROR);
  }
  trackEvent('checkout_started', { tier });

  const context = await getCheckoutMetadataContext();

  const request: StripeCheckoutRequest = {
    tier,
    successUrl: toAbsoluteUrl('/app/account?checkout=success'),
    cancelUrl: toAbsoluteUrl('/pricing?checkout=cancelled'),
    userId: context.userId,
    email: context.email,
    metadata: {
      tier,
      ...(context.userId ? { userId: context.userId } : {}),
      ...(context.email ? { email: context.email } : {}),
    },
  };

  return postForRedirectUrl(env.stripeCheckoutEndpoint, request);
}

export async function createMarketplaceCheckoutUrl(
  listingId: string,
  options?: { successPath?: string; cancelPath?: string },
): Promise<string> {
  if (!hasStripeCheckoutConfig() || !env.stripeCheckoutEndpoint) {
    throw new Error(CHECKOUT_CONFIG_ERROR);
  }

  const normalizedListingId = listingId.trim();
  if (!normalizedListingId) {
    throw new Error('Marketplace listing id is required.');
  }

  const successPath = options?.successPath ?? '/marketplace?purchase=success';
  const cancelPath = options?.cancelPath ?? '/marketplace?purchase=cancelled';

  const request: StripeMarketplaceCheckoutRequest = {
    checkoutType: 'marketplace',
    listingId: normalizedListingId,
    successUrl: toAbsoluteUrl(successPath),
    cancelUrl: toAbsoluteUrl(cancelPath),
  };

  return postForRedirectUrl(env.stripeCheckoutEndpoint, request);
}

export async function createBillingPortalUrl(returnPath = '/app/account'): Promise<string> {
  if (!hasStripePortalConfig() || !env.stripePortalEndpoint) {
    throw new Error(PORTAL_CONFIG_ERROR);
  }
  trackEvent('billing_portal_opened', { returnPath });

  const context = await getCheckoutMetadataContext();

  const request: StripePortalRequest = {
    returnUrl: toAbsoluteUrl(returnPath),
    userId: context.userId,
  };

  return postForRedirectUrl(env.stripePortalEndpoint, request);
}

export async function redirectToCheckout(tier: PaidSubscriptionTier): Promise<void> {
  const url = await createCheckoutUrl(tier);
  if (typeof window === 'undefined') {
    throw new Error('Checkout redirect requires a browser environment.');
  }
  window.location.assign(url);
}

export async function redirectToMarketplaceCheckout(
  listingId: string,
  options?: { successPath?: string; cancelPath?: string },
): Promise<void> {
  const url = await createMarketplaceCheckoutUrl(listingId, options);
  if (typeof window === 'undefined') {
    throw new Error('Checkout redirect requires a browser environment.');
  }
  window.location.assign(url);
}

export async function redirectToBillingPortal(returnPath = '/app/account'): Promise<void> {
  const url = await createBillingPortalUrl(returnPath);
  if (typeof window === 'undefined') {
    throw new Error('Billing portal redirect requires a browser environment.');
  }
  window.location.assign(url);
}
