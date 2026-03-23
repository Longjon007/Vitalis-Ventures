import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { trackEvent } from '../../core/analytics/tracker';
import { redirectToMarketplaceCheckout } from '../../core/billing/stripe';
import { recommendGenerations } from '../../core/recommendation/recommend';
import { buildReferralSignupLink } from '../../core/referrals/referral';
import { setPageMeta } from '../../core/seo/meta';
import {
  createMarketplaceListing,
  getPublicGeneration,
  incrementGenerationPlayCount,
  incrementGenerationShareCount,
  listPublicGenerations,
  toggleGenerationLike,
  type PublicGenerationRecord,
} from '../../core/supabase/public';
import { getErrorMessage } from '../../core/utils/errors';

const FALLBACK_OG_IMAGE = 'https://musicforge.app/og-default.png';
const DEFAULT_PERSONAL_RIGHTS = 'Personal use license. Contact creator for commercial rights.';
const DEFAULT_COMMERCIAL_RIGHTS =
  'Commercial use license. Attribution optional unless otherwise stated by creator.';

function getStringValue(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized || null;
}

function getNumberValue(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return value;
}

function buildDescription(generation: PublicGenerationRecord): string {
  const prompt = generation.prompt.trim();
  if (prompt.length <= 140) return prompt;
  return `${prompt.slice(0, 137)}...`;
}

function formatPrice(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

function parsePriceToCents(value: string): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  const cents = Math.round(parsed * 100);
  if (cents < 99 || cents > 100000) return null;
  return cents;
}

export default function GenerationPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const hasRecordedPlayRef = useRef(false);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generation, setGeneration] = useState<PublicGenerationRecord | null>(null);
  const [suggested, setSuggested] = useState<PublicGenerationRecord[]>([]);
  const [isLiking, setIsLiking] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [listingPrice, setListingPrice] = useState('4.99');
  const [listingLicenseType, setListingLicenseType] = useState<'personal' | 'commercial'>('personal');
  const [listingUsageRights, setListingUsageRights] = useState(DEFAULT_PERSONAL_RIGHTS);
  const [isListing, setIsListing] = useState(false);
  const [isPurchasing, setIsPurchasing] = useState(false);

  useEffect(() => {
    const generationId = (id ?? '').trim();
    if (!generationId) {
      setError('Missing generation id.');
      setIsLoading(false);
      return;
    }

    let active = true;
    setError(null);
    setIsLoading(true);
    setActionMessage(null);

    void (async () => {
      try {
        const record = await getPublicGeneration(generationId);
        if (!active) return;

        if (!record) {
          setGeneration(null);
          setError('This generation is unavailable.');
          return;
        }

        setGeneration(record);
        trackEvent('public_page_view', {
          generationId: record.id,
          creatorUsername: record.creator_username ?? undefined,
        });
      } catch (err) {
        if (!active) return;
        setError(getErrorMessage(err, 'Unable to load this generation.'));
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [id]);

  useEffect(() => {
    hasRecordedPlayRef.current = false;
  }, [generation?.id]);

  useEffect(() => {
    if (!generation) {
      setSuggested([]);
      return;
    }

    let active = true;
    void (async () => {
      try {
        const rows = await listPublicGenerations({ limit: 36, offset: 0 });
        if (!active) return;
        setSuggested(recommendGenerations(generation, rows, 4));
      } catch {
        if (!active) return;
        setSuggested([]);
      }
    })();

    return () => {
      active = false;
    };
  }, [generation]);

  useEffect(() => {
    if (generation?.active_listing_price_cents) {
      setListingPrice((generation.active_listing_price_cents / 100).toFixed(2));
    }
    if (generation?.active_listing_license_type) {
      setListingLicenseType(generation.active_listing_license_type);
    }
    if (generation?.active_listing_usage_rights) {
      setListingUsageRights(generation.active_listing_usage_rights);
    }
  }, [
    generation?.active_listing_price_cents,
    generation?.active_listing_license_type,
    generation?.active_listing_usage_rights,
  ]);

  useEffect(() => {
    if (!generation) {
      setPageMeta({
        title: 'MusicForge Generation',
        description: 'Listen to AI-generated tracks created with MusicForge.',
        image: FALLBACK_OG_IMAGE,
      });
      return;
    }

    const promptSummary = buildDescription(generation);
    const title = `${promptSummary} | MusicForge`;
    const url =
      typeof window !== 'undefined' ? `${window.location.origin}/g/${generation.id}` : undefined;

    setPageMeta({
      title,
      description: `Listen to this AI-generated track on MusicForge: ${promptSummary}`,
      url,
      image: FALLBACK_OG_IMAGE,
      audio: generation.output_url ?? undefined,
    });
  }, [generation]);

  const metadata = useMemo(() => {
    if (!generation) return null;
    return {
      genre: getStringValue(generation.input_params.genre),
      bpm: getNumberValue(generation.input_params.bpm),
      keySignature: getStringValue(generation.input_params.keySignature),
      duration: getNumberValue(generation.input_params.duration),
    };
  }, [generation]);

  const signupHref = buildReferralSignupLink(generation?.creator_referral_code ?? '', 'generation_page');
  const remixHref = generation ? `/app/create?remix=${generation.id}` : '/app/create';
  const shareUrl = useMemo(() => {
    if (!generation) return '';
    if (typeof window === 'undefined') return `/g/${generation.id}`;
    return `${window.location.origin}/g/${generation.id}`;
  }, [generation]);

  function handleSignupClick() {
    trackEvent('public_to_signup_click', {
      source: 'generation_page',
      generationId: generation?.id,
      username: generation?.creator_username ?? undefined,
      referralCode: generation?.creator_referral_code ?? undefined,
    });
  }

  async function handleLikeToggle() {
    if (!generation || isLiking) return;

    setIsLiking(true);
    setActionMessage(null);

    const previousLiked = generation.viewer_has_liked;
    const previousLikeCount = generation.like_count;
    const optimisticLiked = !previousLiked;
    const optimisticLikeCount = Math.max(0, previousLikeCount + (optimisticLiked ? 1 : -1));

    setGeneration((prev) =>
      prev
        ? {
            ...prev,
            viewer_has_liked: optimisticLiked,
            like_count: optimisticLikeCount,
          }
        : prev,
    );

    try {
      const result = await toggleGenerationLike(generation.id);
      if (!result.success) {
        setGeneration((prev) =>
          prev
            ? {
                ...prev,
                viewer_has_liked: previousLiked,
                like_count: previousLikeCount,
              }
            : prev,
        );
        if (result.error === 'not_authenticated') {
          setActionMessage('Log in to like tracks.');
        } else {
          setActionMessage('Unable to update like right now.');
        }
        return;
      }

      setGeneration((prev) =>
        prev
          ? {
              ...prev,
              viewer_has_liked: result.liked,
              like_count: result.likeCount,
            }
          : prev,
      );

      trackEvent('generation_liked', {
        generationId: generation.id,
        liked: result.liked,
        source: 'public_generation',
      });
    } catch {
      setGeneration((prev) =>
        prev
          ? {
              ...prev,
              viewer_has_liked: previousLiked,
              like_count: previousLikeCount,
            }
          : prev,
      );
      setActionMessage('Unable to update like right now.');
    } finally {
      setIsLiking(false);
    }
  }

  async function handleAudioPlay() {
    if (!generation || hasRecordedPlayRef.current) return;
    hasRecordedPlayRef.current = true;

    setGeneration((prev) =>
      prev
        ? {
            ...prev,
            play_count: prev.play_count + 1,
          }
        : prev,
    );

    trackEvent('generation_played', {
      generationId: generation.id,
      source: 'public_generation',
    });

    try {
      const playCount = await incrementGenerationPlayCount(generation.id);
      setGeneration((prev) =>
        prev
          ? {
              ...prev,
              play_count: playCount,
            }
          : prev,
      );
    } catch {
      // Ignore non-blocking counter errors.
    }
  }

  async function handleCopyShareLink() {
    if (!generation || !shareUrl) return;
    setActionMessage(null);

    try {
      if (!navigator?.clipboard?.writeText) {
        throw new Error('Clipboard not available');
      }
      await navigator.clipboard.writeText(shareUrl);
      trackEvent('generation_shared', {
        generationId: generation.id,
        method: 'copy_link',
        hadAudio: Boolean(generation.output_url),
      });

      const shareCount = await incrementGenerationShareCount(generation.id);
      setGeneration((prev) =>
        prev
          ? {
              ...prev,
              share_count: shareCount,
            }
          : prev,
      );
      setActionMessage('Public link copied.');
    } catch {
      setActionMessage('Unable to copy link automatically.');
    }
  }

  async function handleCreateListing() {
    if (!generation || isListing) return;
    setActionMessage(null);

    const cents = parsePriceToCents(listingPrice);
    if (!cents) {
      setActionMessage('Enter a valid price between $0.99 and $1,000.00.');
      return;
    }

    setIsListing(true);
    try {
      const result = await createMarketplaceListing(generation.id, cents, {
        licenseType: listingLicenseType,
        usageRights: listingUsageRights,
      });
      if (!result.success || !result.listingId || !result.priceCents) {
        if (result.error === 'not_authenticated') {
          setActionMessage('Log in to list this track.');
        } else if (result.error === 'not_owner') {
          setActionMessage('Only the creator can list this track.');
        } else {
          setActionMessage('Unable to create listing right now.');
        }
        return;
      }

      setGeneration((prev) =>
        prev
          ? {
              ...prev,
              active_listing_id: result.listingId,
              active_listing_price_cents: result.priceCents,
              active_listing_license_type: result.licenseType ?? listingLicenseType,
              active_listing_usage_rights: result.usageRights ?? listingUsageRights,
            }
          : prev,
      );

      trackEvent('track_listed', {
        listingId: result.listingId,
        generationId: generation.id,
        priceCents: result.priceCents,
      });
      trackEvent('license_type_selected', {
        generationId: generation.id,
        listingId: result.listingId,
        licenseType: result.licenseType ?? listingLicenseType,
      });

      setActionMessage(`Track listed for ${formatPrice(result.priceCents)}.`);
    } catch {
      setActionMessage('Unable to create listing right now.');
    } finally {
      setIsListing(false);
    }
  }

  async function handlePurchaseFromGeneration() {
    if (!generation?.active_listing_id || !generation.active_listing_price_cents) return;
    if (isPurchasing) return;
    setIsPurchasing(true);
    setActionMessage(null);

    trackEvent('purchase_started', {
      listingId: generation.active_listing_id,
      generationId: generation.id,
      priceCents: generation.active_listing_price_cents,
      source: 'generation_page',
    });

    try {
      await redirectToMarketplaceCheckout(generation.active_listing_id, {
        successPath: `/g/${generation.id}?purchase=success`,
        cancelPath: `/g/${generation.id}?purchase=cancelled`,
      });
    } catch (err) {
      setActionMessage(getErrorMessage(err, 'Unable to start secure checkout.'));
      setIsPurchasing(false);
    }
  }

  function handleRemixClick() {
    if (!generation) return;
    trackEvent('generation_remixed', {
      parentGenerationId: generation.id,
      source: 'generation_page',
    });
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-10">
      {isLoading && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-5 text-sm text-zinc-300">
          Loading generation...
        </div>
      )}

      {!isLoading && error && (
        <div className="space-y-4">
          <div className="rounded-xl border border-red-900 bg-red-950/30 p-5 text-sm text-red-300">
            {error}
          </div>
          <button
            type="button"
            onClick={() => navigate('/explore')}
            className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
          >
            Browse Explore
          </button>
        </div>
      )}

      {!isLoading && generation && (
        <div className="space-y-6">
          <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
            <p className="text-xs uppercase tracking-wide text-zinc-500">Created with MusicForge</p>
            <h1 className="mt-2 text-2xl font-semibold text-white">{generation.prompt}</h1>
            <p className="mt-2 text-sm text-zinc-400">
              Mode: <span className="capitalize text-zinc-200">{generation.mode}</span>
            </p>

            {generation.creator_username && (
              <p className="mt-1 text-sm text-zinc-400">
                Creator:{' '}
                <Link className="text-forge-accent hover:underline" to={`/u/${generation.creator_username}`}>
                  @{generation.creator_username}
                </Link>
              </p>
            )}

            {generation.parent_generation_id && (
              <p className="mt-1 text-sm text-zinc-400">
                Remixed from{' '}
                <Link
                  className="text-forge-accent hover:underline"
                  to={`/g/${generation.parent_generation_id}`}
                >
                  {generation.parent_prompt || 'original track'}
                </Link>
                {generation.parent_creator_username ? (
                  <span className="text-zinc-500"> by @{generation.parent_creator_username}</span>
                ) : null}
              </p>
            )}

            {generation.output_url && (
              <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900 p-3">
                <audio
                  controls
                  src={generation.output_url}
                  className="w-full"
                  preload="none"
                  onPlay={() => void handleAudioPlay()}
                />
              </div>
            )}

            <div className="mt-4 grid gap-2 text-xs text-zinc-400 sm:grid-cols-3">
              <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2">
                {generation.play_count} plays
              </div>
              <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2">
                {generation.like_count} likes
              </div>
              <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2">
                {generation.share_count} shares
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={isLiking}
                onClick={() => void handleLikeToggle()}
                className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800 disabled:opacity-60"
              >
                {generation.viewer_has_liked ? 'Unlike' : 'Like'}
              </button>
              <button
                type="button"
                onClick={() => void handleCopyShareLink()}
                className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
              >
                Share
              </button>
              <Link
                to={remixHref}
                onClick={handleRemixClick}
                className="rounded-lg bg-forge-accent px-3 py-2 text-sm font-medium text-white hover:bg-forge-accent-hover"
              >
                Remix this
              </Link>
              {generation.output_url && (
                <a
                  href={generation.output_url}
                  download
                  className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
                >
                  Download
                </a>
              )}
            </div>

            <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900 p-3">
              <p className="text-xs uppercase tracking-wide text-zinc-500">Marketplace</p>
              {generation.active_listing_id && generation.active_listing_price_cents ? (
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="space-y-1">
                    <p className="text-sm text-zinc-200">
                      Listed for {formatPrice(generation.active_listing_price_cents)}
                    </p>
                    <p className="text-xs text-zinc-400">
                      License:{' '}
                      <span className="capitalize text-zinc-200">
                        {generation.active_listing_license_type ?? 'personal'}
                      </span>
                    </p>
                    <p className="text-xs text-zinc-500">
                      {generation.active_listing_usage_rights ?? DEFAULT_PERSONAL_RIGHTS}
                    </p>
                    <p className="text-xs text-zinc-500">
                      Revenue split: {Math.round((generation.active_listing_creator_share_bps || 8000) / 100)}% creator /{' '}
                      {100 - Math.round((generation.active_listing_creator_share_bps || 8000) / 100)}% platform
                    </p>
                  </div>
                  {!generation.viewer_is_owner && (
                    <button
                      type="button"
                      disabled={isPurchasing}
                      className="rounded-md bg-forge-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-forge-accent-hover"
                      onClick={() => void handlePurchaseFromGeneration()}
                    >
                      {isPurchasing ? 'Starting Checkout...' : 'Buy With Stripe'}
                    </button>
                  )}
                </div>
              ) : (
                <p className="mt-2 text-xs text-zinc-500">Not listed in marketplace yet.</p>
              )}

              {generation.viewer_is_owner && (
                <div className="mt-3 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="number"
                      min="0.99"
                      step="0.01"
                      value={listingPrice}
                      onChange={(e) => setListingPrice(e.target.value)}
                      className="w-32 rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-white"
                    />
                    <select
                      value={listingLicenseType}
                      onChange={(e) => {
                        const next = e.target.value === 'commercial' ? 'commercial' : 'personal';
                        setListingLicenseType(next);
                        if (next === 'commercial' && listingUsageRights === DEFAULT_PERSONAL_RIGHTS) {
                          setListingUsageRights(DEFAULT_COMMERCIAL_RIGHTS);
                        }
                        if (next === 'personal' && listingUsageRights === DEFAULT_COMMERCIAL_RIGHTS) {
                          setListingUsageRights(DEFAULT_PERSONAL_RIGHTS);
                        }
                      }}
                      className="rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-white"
                    >
                      <option value="personal">Personal license</option>
                      <option value="commercial">Commercial license</option>
                    </select>
                    <button
                      type="button"
                      disabled={isListing}
                      onClick={() => void handleCreateListing()}
                      className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-800 disabled:opacity-60"
                    >
                      {isListing ? 'Listing...' : 'Sell This Track'}
                    </button>
                  </div>
                  <input
                    type="text"
                    value={listingUsageRights}
                    onChange={(e) => setListingUsageRights(e.target.value)}
                    className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-white"
                    placeholder="License usage rights"
                  />
                </div>
              )}
            </div>

            {actionMessage && <p className="mt-3 text-xs text-zinc-400">{actionMessage}</p>}
          </section>

          <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
            <h2 className="text-lg font-medium text-white">Track metadata</h2>
            <div className="mt-3 grid gap-2 text-sm text-zinc-300 sm:grid-cols-2">
              <div>Genre: {metadata?.genre ?? 'Unknown'}</div>
              <div>BPM: {metadata?.bpm ?? 'Unknown'}</div>
              <div>Key: {metadata?.keySignature ?? 'Unknown'}</div>
              <div>Duration: {metadata?.duration ? `${metadata.duration}s` : 'Unknown'}</div>
            </div>
          </section>

          {suggested.length > 0 && (
            <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
              <h2 className="text-lg font-medium text-white">More like this</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {suggested.map((item) => (
                  <article key={item.id} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
                    <Link to={`/g/${item.id}`} className="text-sm font-medium text-white hover:text-forge-accent">
                      {item.prompt}
                    </Link>
                    <p className="mt-1 text-xs text-zinc-500">
                      {item.play_count} plays • {item.like_count} likes
                    </p>
                  </article>
                ))}
              </div>
            </section>
          )}

          <section className="rounded-2xl border border-forge-accent/30 bg-forge-accent/5 p-6">
            <h2 className="text-lg font-semibold text-white">Create your own track</h2>
            <p className="mt-2 text-sm text-zinc-300">
              Start free on MusicForge and generate your first AI track in minutes.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <a
                href={signupHref}
                onClick={handleSignupClick}
                className="rounded-lg bg-forge-accent px-4 py-2 text-sm font-medium text-white hover:bg-forge-accent-hover"
              >
                Create your own track -&gt;
              </a>
              <Link
                to="/explore"
                className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
              >
                Explore more tracks
              </Link>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
