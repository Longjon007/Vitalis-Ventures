import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/Button';
import { trackEvent } from '../../core/analytics/tracker';
import { getPlanCredits } from '../../core/billing/plan-credits';
import { getSupabase } from '../../core/supabase/client';
import { getCreatorMarketplaceSummary } from '../../core/supabase/public';
import {
  buildReferralSignupLink,
  getCurrentUserReferralCode,
  getReferralRewardPreview,
} from '../../core/referrals/referral';
import { useAuthStore } from '../../core/state/auth-store';
import { useSubscriptionStore } from '../../core/state/subscription-store';

function formatSubscriptionStatus(status: string | null): string {
  if (!status) return 'Unknown';
  return status
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export default function AccountPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const {
    tier,
    subscriptionStatus,
    expiresAt,
    billingStatus,
    billingError,
    isStripeReady,
    isSyncing,
    syncError,
    startCheckout,
    openBillingPortal,
    clearBillingError,
    refreshFromProfile,
  } = useSubscriptionStore();

  const isPending = billingStatus === 'pending';
  const planCredits = useMemo(() => getPlanCredits(tier), [tier]);
  const renewalDate = expiresAt ? new Date(expiresAt).toLocaleDateString() : null;
  const statusLabel = formatSubscriptionStatus(subscriptionStatus);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [referralCopied, setReferralCopied] = useState(false);
  const [marketplaceSummary, setMarketplaceSummary] = useState({
    listingCount: 0,
    activeListingCount: 0,
    totalSales: 0,
    totalRevenue: 0,
  });
  const [connectAccountId, setConnectAccountId] = useState<string | null>(null);
  const [payoutsEnabled, setPayoutsEnabled] = useState(false);
  const [isStartingPayoutOnboarding, setIsStartingPayoutOnboarding] = useState(false);
  const [payoutError, setPayoutError] = useState<string | null>(null);
  const rewardPreview = useMemo(() => getReferralRewardPreview(), []);

  useEffect(() => {
    if (user?.id) {
      void refreshFromProfile(user.id);
    }
  }, [user?.id, refreshFromProfile]);

  useEffect(() => {
    let active = true;
    if (!user?.id) {
      setReferralCode(null);
      return;
    }

    void (async () => {
      const code = await getCurrentUserReferralCode();
      if (!active) return;
      setReferralCode(code);
    })();

    return () => {
      active = false;
    };
  }, [user?.id]);

  useEffect(() => {
    let active = true;
    if (!user?.id) {
      setConnectAccountId(null);
      setPayoutsEnabled(false);
      return;
    }

    const supabase = getSupabase();
    if (!supabase) {
      setConnectAccountId(null);
      setPayoutsEnabled(false);
      return;
    }

    void (async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('stripe_account_id, payouts_enabled')
        .eq('id', user.id)
        .maybeSingle();

      if (!active) return;
      if (error || !data) {
        setConnectAccountId(null);
        setPayoutsEnabled(false);
        return;
      }

      setConnectAccountId(typeof data.stripe_account_id === 'string' ? data.stripe_account_id : null);
      setPayoutsEnabled(data.payouts_enabled === true);
    })();

    return () => {
      active = false;
    };
  }, [user?.id]);

  useEffect(() => {
    let active = true;
    if (!user?.id) {
      setMarketplaceSummary({
        listingCount: 0,
        activeListingCount: 0,
        totalSales: 0,
        totalRevenue: 0,
      });
      return;
    }

    void (async () => {
      try {
        const summary = await getCreatorMarketplaceSummary();
        if (!active) return;
        setMarketplaceSummary(summary);
      } catch {
        if (!active) return;
        setMarketplaceSummary({
          listingCount: 0,
          activeListingCount: 0,
          totalSales: 0,
          totalRevenue: 0,
        });
      }
    })();

    return () => {
      active = false;
    };
  }, [user?.id]);

  async function handleUpgrade(tierTarget: 'pro' | 'studio') {
    clearBillingError();
    await startCheckout(tierTarget);
  }

  async function handleOpenBillingPortal() {
    clearBillingError();
    await openBillingPortal();
  }

  async function handleSetupPayouts() {
    if (isStartingPayoutOnboarding) return;
    setPayoutError(null);

    const supabase = getSupabase();
    if (!supabase) {
      setPayoutError('Supabase is not configured.');
      return;
    }

    setIsStartingPayoutOnboarding(true);
    try {
      const returnUrl =
        typeof window !== 'undefined'
          ? `${window.location.origin}/app/account`
          : '/app/account';

      const { data, error } = await supabase.functions.invoke('create-connect-account', {
        body: {
          returnUrl,
          refreshUrl: returnUrl,
        },
      });

      if (error) {
        throw new Error(error.message || 'Unable to start payout onboarding.');
      }

      const payload = (data ?? {}) as Record<string, unknown>;
      const url = typeof payload.url === 'string' ? payload.url : null;
      const accountId = typeof payload.accountId === 'string' ? payload.accountId : null;
      const hasExistingAccount = Boolean(connectAccountId || accountId);

      trackEvent('payouts_initiated', {
        source: 'account_page',
        hasExistingAccount,
        accountId: accountId ?? undefined,
      });

      if (!url) {
        throw new Error('Stripe Connect onboarding link was not returned.');
      }

      if (accountId) {
        setConnectAccountId(accountId);
      }

      if (typeof window !== 'undefined') {
        window.location.assign(url);
      }
    } catch (err) {
      setPayoutError(err instanceof Error ? err.message : 'Unable to start payout onboarding.');
    } finally {
      setIsStartingPayoutOnboarding(false);
    }
  }

  async function handleCopyReferralLink() {
    if (!referralCode || !navigator?.clipboard?.writeText) {
      return;
    }
    const link = buildReferralSignupLink(referralCode, 'account');
    await navigator.clipboard.writeText(link);
    setReferralCopied(true);
    trackEvent('referral_link_clicked', {
      placement: 'account',
      referralCode,
    });
  }

  function handleCreditPackInterest(packId: string, cents: number) {
    trackEvent('purchase_started', {
      listingId: packId,
      generationId: 'credit_pack',
      priceCents: cents,
      source: 'account_page',
      placeholder: true,
    });
    trackEvent('purchase_completed', {
      listingId: packId,
      generationId: 'credit_pack',
      priceCents: cents,
      source: 'account_page',
      placeholder: true,
    });
    navigate('/pricing');
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
        <h1 className="text-2xl font-semibold text-white">Account</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Manage your plan, billing details, and monthly ForgeAI credits.
        </p>
      </section>

      {(billingError || syncError || !isStripeReady) && (
        <section className="rounded-2xl border border-amber-800/60 bg-amber-950/30 p-4 text-sm text-amber-300">
          {billingError || syncError || 'Stripe billing endpoints are not configured yet. Billing actions are safely disabled.'}
        </section>
      )}

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
          <h2 className="text-lg font-medium text-white">Current Plan</h2>
          <p className="mt-2 text-sm text-zinc-400">
            Tier: <span className="font-semibold capitalize text-white">{tier}</span>
          </p>
          <p className="mt-1 text-sm text-zinc-400">
            Subscription status: <span className="font-semibold text-white">{statusLabel}</span>
          </p>
          <p className="mt-1 text-sm text-zinc-400">
            Monthly credits: <span className="font-semibold text-white">{planCredits.monthlyCredits}</span>
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            Credits reset each billing cycle.
          </p>
          <p className="mt-1 text-sm text-zinc-400">
            Max generation length:{' '}
            <span className="font-semibold text-white">{Math.round(planCredits.aiMaxDurationSeconds / 60)} minutes</span>
          </p>
          {renewalDate && (
            <p className="mt-1 text-sm text-zinc-400">
              Renews/Expires: <span className="font-semibold text-white">{renewalDate}</span>
            </p>
          )}
          {isSyncing && <p className="mt-2 text-xs text-zinc-500">Refreshing subscription data…</p>}
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
          <h2 className="text-lg font-medium text-white">Billing Controls</h2>
          <p className="mt-2 text-sm text-zinc-400">
            Open the Stripe billing portal to update payment methods, invoices, and subscription status.
          </p>

          <div className="mt-4 flex flex-wrap gap-3">
            <Button variant="secondary" onClick={() => navigate('/pricing')}>
              View Pricing
            </Button>
            <Button variant="secondary" onClick={() => navigate('/app/diagnostics')}>
              Diagnostics
            </Button>
            <Button
              variant="primary"
              disabled={isPending || !isStripeReady}
              onClick={() => void handleOpenBillingPortal()}
            >
              {isPending ? 'Opening…' : 'Manage Billing'}
            </Button>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
        <h2 className="text-lg font-medium text-white">Creator Earnings</h2>
        <p className="mt-2 text-sm text-zinc-400">
          Marketplace sales tracking and payouts are rolling out. Current values below are safe placeholders.
        </p>
        <div className="mt-4 grid gap-2 text-xs text-zinc-300 md:grid-cols-4">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2">
            Listings: {marketplaceSummary.listingCount}
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2">
            Active listings: {marketplaceSummary.activeListingCount}
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2">
            Total sales: {marketplaceSummary.totalSales}
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2">
            Revenue: ${(marketplaceSummary.totalRevenue / 100).toFixed(2)}
          </div>
        </div>
        <p className="mt-2 text-xs text-zinc-500">Payouts dashboard coming soon.</p>
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
        <h2 className="text-lg font-medium text-white">Creator Payouts</h2>
        <p className="mt-2 text-sm text-zinc-400">
          Connect Stripe to receive marketplace payouts. Current revenue split foundation is 80% creator / 20% platform.
        </p>
        <div className="mt-3 grid gap-2 text-xs text-zinc-300 md:grid-cols-2">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2">
            Stripe account: {connectAccountId ? 'Connected' : 'Not connected'}
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2">
            Payout status: {payoutsEnabled ? 'Enabled' : 'Pending onboarding'}
          </div>
        </div>
        {payoutError && (
          <p className="mt-3 rounded-md border border-red-900 bg-red-950/30 px-3 py-2 text-xs text-red-300">
            {payoutError}
          </p>
        )}
        <div className="mt-4">
          <Button
            variant="secondary"
            onClick={() => void handleSetupPayouts()}
            disabled={isStartingPayoutOnboarding}
          >
            {isStartingPayoutOnboarding
              ? 'Opening Stripe…'
              : connectAccountId
                ? 'Continue Payout Setup'
                : 'Set Up Payouts'}
          </Button>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
        <h2 className="text-lg font-medium text-white">Upgrade</h2>
        <p className="mt-2 text-sm text-zinc-400">
          Need more creation capacity? Start checkout for a higher tier anytime.
        </p>

        <div className="mt-4 flex flex-wrap gap-3">
          <Button
            variant="secondary"
            disabled={tier === 'pro' || tier === 'studio' || isPending}
            onClick={() => void handleUpgrade('pro')}
          >
            {tier === 'pro' || tier === 'studio' ? 'Pro Included' : isPending ? 'Redirecting…' : 'Upgrade to Pro'}
          </Button>

          <Button
            variant="primary"
            disabled={tier === 'studio' || isPending}
            onClick={() => void handleUpgrade('studio')}
          >
            {tier === 'studio' ? 'Studio Included' : isPending ? 'Redirecting…' : 'Upgrade to Studio'}
          </Button>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
        <h2 className="text-lg font-medium text-white">Credit Packs (Coming Soon)</h2>
        <p className="mt-2 text-sm text-zinc-400">
          One-time credit packs are in rollout for creators who need extra generation capacity mid-cycle.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button variant="secondary" onClick={() => handleCreditPackInterest('pack_25', 1200)}>
            25 Credits • $12
          </Button>
          <Button variant="secondary" onClick={() => handleCreditPackInterest('pack_75', 2900)}>
            75 Credits • $29
          </Button>
          <Button variant="secondary" onClick={() => handleCreditPackInterest('pack_200', 6900)}>
            200 Credits • $69
          </Button>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
        <h2 className="text-lg font-medium text-white">Notifications (Beta)</h2>
        <p className="mt-2 text-sm text-zinc-400">
          Activity feed will include alerts like “your track got likes” and “your track was remixed.”
        </p>
        <ul className="mt-3 space-y-2 text-xs text-zinc-500">
          <li>Generation complete events are captured.</li>
          <li>Track liked and track sold events are captured.</li>
        </ul>
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
        <h2 className="text-lg font-medium text-white">AI Style Personalization</h2>
        <p className="mt-2 text-sm text-zinc-400">
          MusicForge now stores a lightweight style profile from your generation history to improve defaults across future creation and API workflows.
        </p>
        <p className="mt-2 text-xs text-zinc-500">Train your style controls: coming soon.</p>
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
        <h2 className="text-lg font-medium text-white">Referral (Coming Soon)</h2>
        <p className="mt-2 text-sm text-zinc-400">
          Invite friends -&gt; get credits (coming soon). Share your invite link now and we will
          apply rewards when referral credits launch.
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          Planned rewards: {rewardPreview.referrerBonusCredits} credits for you +{' '}
          {rewardPreview.referredBonusCredits} credits for your friend.
        </p>
        {referralCode ? (
          <div className="mt-4 space-y-3">
            <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-300 break-all">
              {buildReferralSignupLink(referralCode, 'account')}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="secondary" onClick={() => void handleCopyReferralLink()}>
                Copy Invite Link
              </Button>
              {referralCopied && (
                <span className="text-xs text-emerald-300">Invite link copied.</span>
              )}
            </div>
          </div>
        ) : (
          <p className="mt-3 text-xs text-zinc-500">Generating your referral link...</p>
        )}
      </section>
    </div>
  );
}
