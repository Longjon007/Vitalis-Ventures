import { isSupabaseConfigured } from '../supabase/client';
import {
  env,
  hasAnalyticsConfig,
  hasAppOriginConfig,
  hasRunGenerationConfig,
  hasStripeBillingConfig,
} from './env';

export interface LaunchReadiness {
  supabaseConfigured: boolean;
  billingConfigured: boolean;
  generationEndpointConfigured: boolean;
  appOriginConfigured: boolean;
  analyticsConfigured: boolean;
  checkoutEndpointConfigured: boolean;
  portalEndpointConfigured: boolean;
  correlationIdSupportReady: boolean;
}

export function getLaunchReadiness(): LaunchReadiness {
  const checkoutEndpointConfigured = Boolean(env.stripeCheckoutEndpoint);
  const portalEndpointConfigured = Boolean(env.stripePortalEndpoint);
  const generationEndpointConfigured = hasRunGenerationConfig();

  return {
    supabaseConfigured: isSupabaseConfigured(),
    billingConfigured: hasStripeBillingConfig(),
    generationEndpointConfigured,
    appOriginConfigured: hasAppOriginConfig(),
    analyticsConfigured: hasAnalyticsConfig(),
    checkoutEndpointConfigured,
    portalEndpointConfigured,
    correlationIdSupportReady:
      checkoutEndpointConfigured || portalEndpointConfigured || generationEndpointConfigured,
  };
}
