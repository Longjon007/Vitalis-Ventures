import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { trackEvent } from '../../core/analytics/tracker';
import { redirectToMarketplaceCheckout } from '../../core/billing/stripe';
import { setPageMeta } from '../../core/seo/meta';
import {
  listMarketplaceListings,
  type MarketplaceListingRecord,
} from '../../core/supabase/public';
import { getErrorMessage } from '../../core/utils/errors';

const FALLBACK_OG_IMAGE = 'https://musicforge.app/og-default.png';

function formatPrice(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

function formatLicenseType(value: 'personal' | 'commercial'): string {
  return value === 'commercial' ? 'Commercial' : 'Personal';
}

export default function MarketplacePage() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<MarketplaceListingRecord[]>([]);
  const [purchaseMessage, setPurchaseMessage] = useState<string | null>(null);
  const [isPurchasingListingId, setIsPurchasingListingId] = useState<string | null>(null);

  useEffect(() => {
    setPageMeta({
      title: 'Marketplace | MusicForge',
      description: 'Discover and purchase creator-listed AI tracks from MusicForge.',
      url: typeof window !== 'undefined' ? `${window.location.origin}/marketplace` : undefined,
      image: FALLBACK_OG_IMAGE,
    });

    let active = true;
    setError(null);
    setIsLoading(true);

    void (async () => {
      try {
        const rows = await listMarketplaceListings({ limit: 48, offset: 0 });
        if (!active) return;
        setItems(rows);
      } catch (err) {
        if (!active) return;
        setError(getErrorMessage(err, 'Unable to load marketplace.'));
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  async function handleBuy(listing: MarketplaceListingRecord) {
    if (isPurchasingListingId) return;
    setPurchaseMessage(null);
    setIsPurchasingListingId(listing.id);
    trackEvent('purchase_started', {
      listingId: listing.id,
      generationId: listing.generation_id,
      priceCents: listing.price_cents,
      source: 'marketplace',
    });

    try {
      await redirectToMarketplaceCheckout(listing.id, {
        successPath: `/marketplace?purchase=success&listing=${listing.id}`,
        cancelPath: `/marketplace?purchase=cancelled&listing=${listing.id}`,
      });
    } catch (err) {
      setPurchaseMessage(getErrorMessage(err, 'Unable to start secure checkout.'));
      setIsPurchasingListingId(null);
    }
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-10">
      <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
        <p className="text-xs uppercase tracking-wide text-zinc-500">MusicForge Marketplace</p>
        <h1 className="mt-2 text-3xl font-semibold text-white">Buy creator-listed tracks</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Discover tracks listed by creators, preview instantly, and purchase with Stripe checkout.
        </p>
        <p className="mt-2 text-xs text-zinc-500">Creator payouts dashboard: coming soon.</p>
        <div className="mt-4">
          <Link
            to="/explore"
            className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-200 hover:bg-zinc-800"
          >
            Back to Explore
          </Link>
        </div>
      </section>

      {purchaseMessage && (
        <div className="mt-6 rounded-xl border border-amber-800/60 bg-amber-950/30 p-4 text-sm text-amber-300">
          {purchaseMessage}
        </div>
      )}

      {isLoading && (
        <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-950 p-5 text-sm text-zinc-300">
          Loading marketplace listings...
        </div>
      )}

      {!isLoading && error && (
        <div className="mt-6 rounded-xl border border-red-900 bg-red-950/30 p-5 text-sm text-red-300">
          {error}
        </div>
      )}

      {!isLoading && !error && (
        <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((listing) => (
            <article key={listing.id} className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
              <Link to={`/g/${listing.generation_id}`} className="text-sm font-medium text-white hover:text-forge-accent">
                {listing.prompt}
              </Link>
              <p className="mt-1 text-xs text-zinc-500 capitalize">
                {listing.mode}
                {listing.creator_username ? (
                  <span> • by @{listing.creator_username}</span>
                ) : null}
              </p>
              {listing.output_url && (
                <audio controls src={listing.output_url} className="mt-3 w-full" preload="none" />
              )}
              <p className="mt-2 text-xs text-zinc-400">
                License: {formatLicenseType(listing.license_type)}
              </p>
              <p className="mt-1 text-xs text-zinc-500">{listing.usage_rights}</p>
              <p className="mt-1 text-xs text-zinc-500">
                Creator share: {Math.round(listing.creator_share_bps / 100)}%
              </p>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-sm font-semibold text-white">{formatPrice(listing.price_cents)}</span>
                <button
                  type="button"
                  disabled={Boolean(isPurchasingListingId)}
                  className="rounded-md bg-forge-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-forge-accent-hover"
                  onClick={() => void handleBuy(listing)}
                >
                  {isPurchasingListingId === listing.id ? 'Starting Checkout...' : 'Buy With Stripe'}
                </button>
              </div>
            </article>
          ))}

          {items.length === 0 && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-400">
              No active listings yet. Creators can list tracks from generation pages.
            </div>
          )}
        </section>
      )}
    </div>
  );
}
