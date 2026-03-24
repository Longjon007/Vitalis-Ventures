import { useEffect, useMemo } from 'react';
import { Button } from '../components/Button';
import { trackEvent } from '../core/analytics/tracker';
import { useAuthStore } from '../core/state/auth-store';
import { useSubscriptionStore, SubscriptionTier } from '../core/state/subscription-store';
import type { PaidSubscriptionTier } from '../core/types/billing';
import { getPlanCredits } from '../core/billing/plan-credits';

interface PlanCard {
  tier: SubscriptionTier;
  name: string;
  descriptor: string;
  price: string;
  period: string;
  features: string[];
  highlighted?: boolean;
}

const PLANS: PlanCard[] = [
  {
    tier: 'free',
    name: 'Free',
    descriptor: 'For exploring the workspace',
    price: '$0',
    period: 'forever',
    features: [
      'Import audio & MIDI files',
      'Basic piano roll & tab editor',
      'Up to 2 projects, 4 tracks each',
      '3 AI generations/month included',
    ],
  },
  {
    tier: 'pro',
    name: 'Pro',
    descriptor: 'For serious music creators',
    price: '$9',
    period: '/month',
    highlighted: true,
    features: [
      'Everything in Free',
      'Unlimited projects & tracks',
      'Full effects chain, mixer, and exports',
      '50 AI generations/month included',
      'MIDI & WAV export, all instruments',
    ],
  },
  {
    tier: 'studio',
    name: 'Studio',
    descriptor: 'For professional workflows',
    price: '$19',
    period: '/month',
    features: [
      'Everything in Pro',
      'Collaboration & sharing',
      'Unlimited AI generations included',
      'AI stem separation & suggestions',
      'Priority support',
    ],
  },
];

function asPaidTier(tier: SubscriptionTier): PaidSubscriptionTier | null {
  if (tier === 'pro' || tier === 'studio') return tier;
  return null;
}

function formatSubscriptionStatus(status: string | null): string | null {
  if (!status) return null;
  return status
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function PricingPage() {
  const user = useAuthStore((s) => s.user);
  const {
    tier: currentTier,
    subscriptionStatus,
    upgradeTo,
    startCheckout,
    billingStatus,
    billingError,
    syncError,
    clearBillingError,
    isStripeReady,
    isSyncing,
    refreshFromProfile,
  } = useSubscriptionStore();

  const isPending = billingStatus === 'pending';
  const paidButtonsDisabled = isPending;
  const statusLabel = formatSubscriptionStatus(subscriptionStatus);

  useEffect(() => {
    if (user?.id) {
      void refreshFromProfile(user.id);
    }
  }, [user?.id, refreshFromProfile]);

  const helperMessage = useMemo(() => {
    if (billingError) return billingError;
    if (syncError) return syncError;
    if (!isStripeReady) {
      return 'Billing checkout is not configured in this environment yet. Paid actions are safely disabled until Stripe endpoints are connected.';
    }
    return null;
  }, [billingError, syncError, isStripeReady]);

  async function handlePaidPlanSelect(tier: SubscriptionTier) {
    const paidTier = asPaidTier(tier);
    if (!paidTier) return;
    clearBillingError();
    await startCheckout(paidTier);
  }

  function handleFreeSelect() {
    clearBillingError();
    upgradeTo('free');
  }

  function handleCreditPackChoice(packId: string, cents: number) {
    trackEvent('purchase_started', {
      listingId: packId,
      generationId: 'credit_pack',
      priceCents: cents,
      source: 'pricing_page',
      placeholder: true,
    });
    trackEvent('purchase_completed', {
      listingId: packId,
      generationId: 'credit_pack',
      priceCents: cents,
      source: 'pricing_page',
      placeholder: true,
    });
  }

  return (
    <div className="flex flex-col h-full overflow-auto">
      <div className="px-6 py-4 border-b border-forge-border bg-forge-surface shrink-0">
        <h2 className="text-lg font-semibold">Plans for Every Creator</h2>
        <p className="text-xs text-forge-muted mt-1">
          Every plan includes the full workspace. Upgrade for more tools, exports, and AI generation.
        </p>
        <p className="text-xs text-forge-muted mt-2">
          Current plan:{' '}
          <span className="text-forge-accent font-semibold capitalize">{currentTier}</span>
          {statusLabel && <span className="ml-2 text-forge-muted">({statusLabel})</span>}
        </p>
      </div>

      <div className="flex-1 p-6">
        {helperMessage && (
          <div className="mb-4 rounded-lg border border-amber-800/60 bg-amber-950/30 px-4 py-3 text-xs text-amber-300">
            {helperMessage}
          </div>
        )}

        {isSyncing && <p className="mb-3 text-xs text-forge-muted">Refreshing subscription status…</p>}

        <div className="mb-6 max-w-4xl mx-auto rounded-xl border border-forge-border bg-forge-surface p-4">
          <h3 className="text-sm font-semibold text-white">How AI credits work</h3>
          <ul className="mt-2 space-y-1 text-xs text-forge-muted">
            <li>All plans include workspace tools (import, edit, arrange) with no credit cost. Credits are only used for AI generation.</li>
            <li>Each generation request currently uses 5 credits.</li>
            <li>Credits reset monthly based on your plan.</li>
            <li>You can upgrade any time from this page or your account billing controls.</li>
          </ul>
        </div>

        <div className="grid gap-6 md:grid-cols-3 max-w-4xl mx-auto">
          {PLANS.map((plan) => {
            const isCurrent = currentTier === plan.tier;
            const planCredits = getPlanCredits(plan.tier);
            const paidTier = asPaidTier(plan.tier);

            return (
              <div
                key={plan.tier}
                className={`rounded-xl border p-6 flex flex-col ${
                  plan.highlighted
                    ? 'border-forge-accent bg-forge-accent/5 ring-1 ring-forge-accent/20'
                    : 'border-forge-border bg-forge-surface'
                }`}
              >
                {plan.highlighted && (
                  <span className="text-[10px] uppercase tracking-wider text-forge-accent font-bold mb-2">
                    Recommended
                  </span>
                )}
                <h3 className="text-xl font-bold">{plan.name}</h3>
                <p className="mt-1 text-xs text-forge-muted">{plan.descriptor}</p>
                <div className="mt-2 mb-2">
                  <span className="text-3xl font-bold">{plan.price}</span>
                  <span className="text-sm text-forge-muted">{plan.period}</span>
                </div>
                <p className="mb-4 text-xs text-forge-muted">
                  {planCredits.monthlyCredits} credits reset monthly • up to{' '}
                  {Math.round(planCredits.aiMaxDurationSeconds / 60)} min generation length
                </p>

                <ul className="space-y-2 flex-1 mb-6">
                  {plan.features.map((f) => (
                    <li key={f} className="text-sm flex items-start gap-2">
                      <span className="text-forge-accent mt-0.5">+</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                {isCurrent ? (
                  <Button variant="ghost" disabled>
                    Current Plan
                  </Button>
                ) : paidTier ? (
                  <Button
                    variant={plan.highlighted ? 'primary' : 'secondary'}
                    disabled={paidButtonsDisabled}
                    onClick={() => void handlePaidPlanSelect(plan.tier)}
                  >
                    {isPending ? 'Redirecting…' : plan.tier === 'pro' ? 'Upgrade to Pro' : 'Upgrade to Studio'}
                  </Button>
                ) : (
                  <Button variant="secondary" onClick={handleFreeSelect}>
                    Start Free
                  </Button>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-8 max-w-4xl mx-auto rounded-xl border border-forge-border bg-forge-surface p-4">
          <h3 className="text-sm font-semibold text-white">Credit Packs (Rolling Out)</h3>
          <p className="mt-1 text-xs text-forge-muted">
            Need extra capacity mid-cycle? One-time credit packs are coming soon.
            Credits are for AI generation only. Import, editing, and workspace tools are unlimited on all plans.
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            <Button variant="secondary" onClick={() => handleCreditPackChoice('pack_25', 1200)}>
              25 Credits • $12
            </Button>
            <Button variant="secondary" onClick={() => handleCreditPackChoice('pack_75', 2900)}>
              75 Credits • $29
            </Button>
            <Button variant="secondary" onClick={() => handleCreditPackChoice('pack_200', 6900)}>
              200 Credits • $69
            </Button>
          </div>
        </div>

        <p className="text-center text-xs text-forge-muted mt-8 max-w-lg mx-auto">
          Credits reset each billing cycle. Cancel anytime, no hidden fees, and manage payment details in the billing portal.
        </p>
      </div>
    </div>
  );
}
