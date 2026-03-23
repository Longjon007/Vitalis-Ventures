import { env } from '../config/env';
import type { AnalyticsEventName, AnalyticsEventProps } from './events';

type AnalyticsPayload = {
  event: AnalyticsEventName;
  properties: Record<string, unknown>;
  timestamp: string;
};

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

function isDevMode(): boolean {
  return import.meta.env.DEV;
}

function safeProviderName(): string {
  return (env.analyticsProvider ?? '').trim().toLowerCase();
}

function logDevEvent(payload: AnalyticsPayload): void {
  if (!isDevMode()) return;
  try {
    console.debug('[analytics]', payload.event, payload.properties);
  } catch {
    // Ignore console failures.
  }
}

function getWindowWithOptionalProviders(): Window & {
  posthog?: { capture?: (event: string, properties?: Record<string, unknown>) => void };
  plausible?: (event: string, options?: { props?: Record<string, unknown> }) => void;
} {
  return window as Window & {
    posthog?: { capture?: (event: string, properties?: Record<string, unknown>) => void };
    plausible?: (event: string, options?: { props?: Record<string, unknown> }) => void;
  };
}

function sendToCustomEndpoint(payload: AnalyticsPayload): void {
  if (!isBrowser() || !env.analyticsEndpoint) return;

  try {
    const endpoint = env.analyticsEndpoint;
    if (!endpoint) return;

    const body = JSON.stringify(payload);
    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: 'application/json' });
      navigator.sendBeacon(endpoint, blob);
      return;
    }

    void fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    });
  } catch {
    // Never throw from analytics.
  }
}

function sendToProvider(payload: AnalyticsPayload): void {
  if (!isBrowser()) return;

  const provider = safeProviderName();
  const win = getWindowWithOptionalProviders();

  try {
    if ((provider === 'posthog' || env.posthogKey) && win.posthog?.capture) {
      win.posthog.capture(payload.event, payload.properties);
      return;
    }

    if (provider === 'plausible' && typeof win.plausible === 'function') {
      win.plausible(payload.event, { props: payload.properties });
      return;
    }

    sendToCustomEndpoint(payload);
  } catch {
    // Never throw from analytics.
  }
}

export function trackEvent<T extends AnalyticsEventName>(
  name: T,
  properties: AnalyticsEventProps<T> = {} as AnalyticsEventProps<T>,
): void {
  const payload: AnalyticsPayload = {
    event: name,
    properties: { ...properties },
    timestamp: new Date().toISOString(),
  };

  logDevEvent(payload);
  sendToProvider(payload);
}
