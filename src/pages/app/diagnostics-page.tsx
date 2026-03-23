import { useEffect, useState } from 'react';
import { getLaunchReadiness } from '../../core/config/health';
import { useAuthStore } from '../../core/state/auth-store';
import { useSubscriptionStore } from '../../core/state/subscription-store';
import { getCreditWallet, type CreditWallet } from '../../core/supabase/credits';
import { listGenerations } from '../../core/supabase/generations';
import { getErrorMessage } from '../../core/utils/errors';

type AsyncDiagnosticsState = {
  wallet: CreditWallet | null;
  generationCount: number;
  loadError: string | null;
};

function formatBool(value: boolean): string {
  return value ? 'Yes' : 'No';
}

function maskUserId(userId: string | null | undefined): string {
  if (!userId) return 'N/A';
  if (userId.length <= 8) return userId;
  return `${userId.slice(0, 4)}...${userId.slice(-4)}`;
}

function formatDateTime(timestampMs: number | null): string {
  if (!timestampMs) return 'N/A';
  const date = new Date(timestampMs);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleString();
}

export default function DiagnosticsPage() {
  const authStatus = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
  const session = useAuthStore((s) => s.session);
  const tier = useSubscriptionStore((s) => s.tier);
  const subscriptionStatus = useSubscriptionStore((s) => s.subscriptionStatus);
  const lastSyncedAt = useSubscriptionStore((s) => s.lastSyncedAt);
  const readiness = getLaunchReadiness();

  const [state, setState] = useState<AsyncDiagnosticsState>({
    wallet: null,
    generationCount: 0,
    loadError: null,
  });

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const [wallet, generations] = await Promise.all([getCreditWallet(), listGenerations()]);
        if (cancelled) return;

        setState({
          wallet,
          generationCount: generations.length,
          loadError: null,
        });
      } catch (err) {
        if (cancelled) return;
        setState((prev) => ({
          ...prev,
          loadError: getErrorMessage(err, 'Diagnostics data could not be loaded.'),
        }));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
        <h1 className="text-2xl font-semibold text-white">Launch Diagnostics</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Non-sensitive readiness and runtime checks for launch and post-launch operations.
        </p>
      </section>

      {state.loadError && (
        <section className="rounded-2xl border border-amber-800/60 bg-amber-950/30 p-4 text-sm text-amber-300">
          {state.loadError}
        </section>
      )}

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
          <h2 className="text-lg font-medium text-white">Auth</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-zinc-400">Status</dt>
              <dd className="text-white capitalize">{authStatus}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-zinc-400">User ID</dt>
              <dd className="text-white">{maskUserId(user?.id)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-zinc-400">Session Present</dt>
              <dd className="text-white">{formatBool(Boolean(session))}</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
          <h2 className="text-lg font-medium text-white">Subscription</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-zinc-400">Tier</dt>
              <dd className="text-white capitalize">{tier}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-zinc-400">Status</dt>
              <dd className="text-white capitalize">{subscriptionStatus ?? 'unknown'}</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
        <h2 className="text-lg font-medium text-white">Configuration Readiness</h2>
        <dl className="mt-3 grid gap-2 text-sm md:grid-cols-2">
          <div className="flex justify-between gap-4 rounded-lg border border-zinc-800 px-3 py-2">
            <dt className="text-zinc-400">Supabase Configured</dt>
            <dd className="text-white">{formatBool(readiness.supabaseConfigured)}</dd>
          </div>
          <div className="flex justify-between gap-4 rounded-lg border border-zinc-800 px-3 py-2">
            <dt className="text-zinc-400">Billing Configured</dt>
            <dd className="text-white">{formatBool(readiness.billingConfigured)}</dd>
          </div>
          <div className="flex justify-between gap-4 rounded-lg border border-zinc-800 px-3 py-2">
            <dt className="text-zinc-400">Checkout Endpoint Ready</dt>
            <dd className="text-white">{formatBool(readiness.checkoutEndpointConfigured)}</dd>
          </div>
          <div className="flex justify-between gap-4 rounded-lg border border-zinc-800 px-3 py-2">
            <dt className="text-zinc-400">Portal Endpoint Ready</dt>
            <dd className="text-white">{formatBool(readiness.portalEndpointConfigured)}</dd>
          </div>
          <div className="flex justify-between gap-4 rounded-lg border border-zinc-800 px-3 py-2">
            <dt className="text-zinc-400">Generation Endpoint Ready</dt>
            <dd className="text-white">{formatBool(readiness.generationEndpointConfigured)}</dd>
          </div>
          <div className="flex justify-between gap-4 rounded-lg border border-zinc-800 px-3 py-2">
            <dt className="text-zinc-400">App Origin Configured</dt>
            <dd className="text-white">{formatBool(readiness.appOriginConfigured)}</dd>
          </div>
          <div className="flex justify-between gap-4 rounded-lg border border-zinc-800 px-3 py-2 md:col-span-2">
            <dt className="text-zinc-400">Analytics Configured (Optional)</dt>
            <dd className="text-white">{formatBool(readiness.analyticsConfigured)}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
        <h2 className="text-lg font-medium text-white">Runtime Signals</h2>
        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-zinc-400">Credit Wallet Present</dt>
            <dd className="text-white">{formatBool(Boolean(state.wallet))}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-zinc-400">Recent Generation Count</dt>
            <dd className="text-white">{state.generationCount}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
        <h2 className="text-lg font-medium text-white">Operations Snapshot</h2>
        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-zinc-400">Last Known Subscription Tier</dt>
            <dd className="text-white capitalize">{tier}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-zinc-400">Last Known Subscription Status</dt>
            <dd className="text-white capitalize">{subscriptionStatus ?? 'unknown'}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-zinc-400">Last Subscription Sync</dt>
            <dd className="text-white">{formatDateTime(lastSyncedAt)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-zinc-400">Billing Endpoints Ready</dt>
            <dd className="text-white">{formatBool(readiness.billingConfigured)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-zinc-400">Generation Endpoint Ready</dt>
            <dd className="text-white">{formatBool(readiness.generationEndpointConfigured)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-zinc-400">Analytics Provider Configured</dt>
            <dd className="text-white">{formatBool(readiness.analyticsConfigured)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-zinc-400">Correlation ID Support Ready</dt>
            <dd className="text-white">{formatBool(readiness.correlationIdSupportReady)}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
