function readEnv(name: string): string | null {
  const value = import.meta.env[name] as string | undefined;
  if (!value) return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function getSupabaseFunctionsBaseUrl(): string | null {
  const supabaseUrl = readEnv('VITE_SUPABASE_URL');
  if (!supabaseUrl) return null;
  return `${supabaseUrl.replace(/\/+$/, '')}/functions/v1`;
}

function detectFunctionEndpoint(explicitEnvName: string, functionName: string): string | null {
  const explicit = readEnv(explicitEnvName);
  if (explicit) return explicit;

  const base = getSupabaseFunctionsBaseUrl();
  if (!base) return null;
  return `${base}/${functionName}`;
}

function detectAppBaseUrl(): string {
  const envBase = readEnv('VITE_APP_BASE_URL');
  if (envBase) return envBase;
  if (typeof window !== 'undefined' && window.location?.origin) return window.location.origin;
  return 'http://localhost:5173';
}

export const env = {
  appOrigin: readEnv('VITE_APP_BASE_URL'),
  appBaseUrl: detectAppBaseUrl(),
  stripePublishableKey: readEnv('VITE_STRIPE_PUBLISHABLE_KEY'),
  stripeCheckoutEndpoint: detectFunctionEndpoint('VITE_STRIPE_CHECKOUT_ENDPOINT', 'create-checkout-session'),
  stripePortalEndpoint: detectFunctionEndpoint('VITE_STRIPE_PORTAL_ENDPOINT', 'create-portal-session'),
  runGenerationEndpoint: detectFunctionEndpoint('VITE_RUN_GENERATION_ENDPOINT', 'run-generation'),
  analyticsProvider: readEnv('VITE_ANALYTICS_PROVIDER'),
  analyticsEndpoint: readEnv('VITE_ANALYTICS_ENDPOINT'),
  posthogKey: readEnv('VITE_POSTHOG_KEY'),
  posthogHost: readEnv('VITE_POSTHOG_HOST'),
};

export function hasStripeCheckoutConfig(): boolean {
  return Boolean(env.stripeCheckoutEndpoint);
}

export function hasStripePortalConfig(): boolean {
  return Boolean(env.stripePortalEndpoint);
}

export function hasStripeBillingConfig(): boolean {
  return hasStripeCheckoutConfig() && hasStripePortalConfig();
}

export function hasRunGenerationConfig(): boolean {
  return Boolean(env.runGenerationEndpoint);
}

export function hasAppOriginConfig(): boolean {
  return Boolean(env.appOrigin);
}

export function hasAnalyticsConfig(): boolean {
  return Boolean(env.analyticsProvider || env.analyticsEndpoint || env.posthogKey || env.posthogHost);
}
