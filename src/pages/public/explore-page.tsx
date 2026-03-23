import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { trackEvent } from '../../core/analytics/tracker';
import {
  buildPersonalizationProfile,
  personalizeFeed,
  type PersonalizationProfile,
} from '../../core/personalization/personalize';
import { sortByTrending } from '../../core/ranking/trending';
import { setPageMeta } from '../../core/seo/meta';
import { listGenerations } from '../../core/supabase/generations';
import {
  incrementGenerationPlayCount,
  listPublicGenerations,
  toggleGenerationLike,
  type PublicGenerationRecord,
} from '../../core/supabase/public';
import { getErrorMessage } from '../../core/utils/errors';

const FALLBACK_OG_IMAGE = 'https://musicforge.app/og-default.png';
const PAGE_SIZE = 24;

function mergeById(
  current: PublicGenerationRecord[],
  incoming: PublicGenerationRecord[],
): PublicGenerationRecord[] {
  const merged = [...current];
  const seen = new Set(current.map((item) => item.id));
  for (const row of incoming) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    merged.push(row);
  }
  return merged;
}

export default function ExplorePage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<PublicGenerationRecord[]>([]);
  const [sort, setSort] = useState<'newest' | 'trending' | 'for_you'>('newest');
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [activeLikeId, setActiveLikeId] = useState<string | null>(null);
  const [personalizationProfile, setPersonalizationProfile] = useState<PersonalizationProfile>({
    topGenres: [],
    avgBpm: null,
  });

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const audioRefs = useRef<Record<string, HTMLAudioElement | null>>({});
  const playedIdsRef = useRef<Set<string>>(new Set());
  const maxTrackedDepthRef = useRef(0);

  const displayItems = useMemo(() => {
    if (sort === 'trending') return sortByTrending(items);
    if (sort === 'for_you') return personalizeFeed(items, personalizationProfile);
    return items;
  }, [items, personalizationProfile, sort]);

  const loadPage = useCallback(async (targetOffset: number, replace = false) => {
    const initialRequest = targetOffset === 0 && replace;
    if (initialRequest) {
      setIsLoading(true);
    } else {
      setIsLoadingMore(true);
    }
    setError(null);

    try {
      const rows = await listPublicGenerations({ limit: PAGE_SIZE, offset: targetOffset });

      setItems((prev) => (replace ? rows : mergeById(prev, rows)));
      setOffset(targetOffset + rows.length);
      setHasMore(rows.length === PAGE_SIZE);
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to load explore feed.'));
    } finally {
      if (initialRequest) {
        setIsLoading(false);
      } else {
        setIsLoadingMore(false);
      }
    }
  }, []);

  const loadNextPage = useCallback(async () => {
    if (isLoading || isLoadingMore || !hasMore) return;
    await loadPage(offset, false);
  }, [hasMore, isLoading, isLoadingMore, loadPage, offset]);

  useEffect(() => {
    setPageMeta({
      title: 'Explore AI Music Tracks | MusicForge',
      description: 'Discover the newest AI-generated music tracks from MusicForge creators.',
      url: typeof window !== 'undefined' ? `${window.location.origin}/explore` : undefined,
      image: FALLBACK_OG_IMAGE,
    });
  }, []);

  useEffect(() => {
    trackEvent('explore_page_view', { sort });
  }, [sort]);

  useEffect(() => {
    void loadPage(0, true);
  }, [loadPage]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const history = await listGenerations();
        if (!active) return;
        setPersonalizationProfile(buildPersonalizationProfile(history));
      } catch {
        if (!active) return;
        setPersonalizationProfile({ topGenres: [], avgBpm: null });
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (items.length > maxTrackedDepthRef.current) {
      maxTrackedDepthRef.current = items.length;
      trackEvent('explore_scroll_depth', {
        loadedCount: items.length,
        sort,
      });
    }
  }, [items.length, sort]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasMore || isLoading || isLoadingMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry?.isIntersecting) {
          void loadNextPage();
        }
      },
      { rootMargin: '320px 0px' },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, isLoading, isLoadingMore, loadNextPage]);

  function handleSignupClick() {
    trackEvent('public_to_signup_click', {
      source: 'explore_page',
    });
  }

  async function recordPlay(generationId: string) {
    if (playedIdsRef.current.has(generationId)) return;
    playedIdsRef.current.add(generationId);

    trackEvent('generation_played', {
      generationId,
      source: 'explore',
    });

    setItems((prev) =>
      prev.map((item) =>
        item.id === generationId
          ? {
              ...item,
              play_count: item.play_count + 1,
            }
          : item,
      ),
    );

    try {
      const playCount = await incrementGenerationPlayCount(generationId);
      setItems((prev) =>
        prev.map((item) =>
          item.id === generationId
            ? {
                ...item,
                play_count: playCount,
              }
            : item,
        ),
      );
    } catch {
      // Ignore non-blocking counter errors.
    }
  }

  function handleHoverStart(generationId: string) {
    const audio = audioRefs.current[generationId];
    if (!audio) return;

    void audio
      .play()
      .then(() => recordPlay(generationId))
      .catch(() => {
        // Autoplay may be blocked by browser policy.
      });
  }

  function handleHoverEnd(generationId: string) {
    const audio = audioRefs.current[generationId];
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
  }

  async function handleLikeToggle(item: PublicGenerationRecord) {
    if (activeLikeId) return;
    setActiveLikeId(item.id);
    setActionMessage(null);

    const optimisticLiked = !item.viewer_has_liked;
    const optimisticLikeCount = Math.max(0, item.like_count + (optimisticLiked ? 1 : -1));

    setItems((prev) =>
      prev.map((row) =>
        row.id === item.id
          ? {
              ...row,
              viewer_has_liked: optimisticLiked,
              like_count: optimisticLikeCount,
            }
          : row,
      ),
    );

    try {
      const result = await toggleGenerationLike(item.id);
      if (!result.success) {
        setItems((prev) =>
          prev.map((row) =>
            row.id === item.id
              ? {
                  ...row,
                  viewer_has_liked: item.viewer_has_liked,
                  like_count: item.like_count,
                }
              : row,
          ),
        );

        if (result.error === 'not_authenticated') {
          setActionMessage('Log in to like tracks.');
        } else {
          setActionMessage('Unable to update likes right now.');
        }
        return;
      }

      setItems((prev) =>
        prev.map((row) =>
          row.id === item.id
            ? {
                ...row,
                viewer_has_liked: result.liked,
                like_count: result.likeCount,
              }
            : row,
        ),
      );

      trackEvent('generation_liked', {
        generationId: item.id,
        liked: result.liked,
        source: 'explore',
      });
    } catch {
      setItems((prev) =>
        prev.map((row) =>
          row.id === item.id
            ? {
                ...row,
                viewer_has_liked: item.viewer_has_liked,
                like_count: item.like_count,
              }
            : row,
        ),
      );
      setActionMessage('Unable to update likes right now.');
    } finally {
      setActiveLikeId(null);
    }
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-10">
      <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
        <p className="text-xs uppercase tracking-wide text-zinc-500">MusicForge Explore</p>
        <h1 className="mt-2 text-3xl font-semibold text-white">Discover new AI-generated tracks</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Browse trending and newest public generations from creators in the MusicForge ecosystem.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Link
            to="/signup"
            onClick={handleSignupClick}
            className="inline-flex rounded-lg bg-forge-accent px-4 py-2 text-sm font-medium text-white hover:bg-forge-accent-hover"
          >
            Create your own track -&gt;
          </Link>
          <Link
            to="/marketplace"
            className="inline-flex rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
          >
            Open Marketplace
          </Link>
          <div className="inline-flex rounded-lg border border-zinc-700 bg-zinc-900 p-1 text-xs">
            <button
              type="button"
              onClick={() => setSort('newest')}
              className={`rounded-md px-3 py-1.5 ${
                sort === 'newest'
                  ? 'bg-zinc-700 text-white'
                  : 'text-zinc-300 hover:bg-zinc-800'
              }`}
            >
              Newest
            </button>
            <button
              type="button"
              onClick={() => setSort('trending')}
              className={`rounded-md px-3 py-1.5 ${
                sort === 'trending'
                  ? 'bg-zinc-700 text-white'
                  : 'text-zinc-300 hover:bg-zinc-800'
              }`}
            >
              Trending
            </button>
            <button
              type="button"
              onClick={() => setSort('for_you')}
              className={`rounded-md px-3 py-1.5 ${
                sort === 'for_you'
                  ? 'bg-zinc-700 text-white'
                  : 'text-zinc-300 hover:bg-zinc-800'
              }`}
            >
              For You
            </button>
          </div>
        </div>
        {actionMessage && <p className="mt-3 text-xs text-zinc-400">{actionMessage}</p>}
      </section>

      {isLoading && (
        <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-950 p-5 text-sm text-zinc-300">
          Loading explore feed...
        </div>
      )}

      {!isLoading && error && (
        <div className="mt-6 rounded-xl border border-red-900 bg-red-950/30 p-5 text-sm text-red-300">
          {error}
        </div>
      )}

      {!isLoading && !error && (
        <>
          <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {displayItems.map((item) => (
              <article
                key={item.id}
                className="rounded-xl border border-zinc-800 bg-zinc-950 p-4"
                onMouseEnter={() => handleHoverStart(item.id)}
                onMouseLeave={() => handleHoverEnd(item.id)}
              >
                <Link to={`/g/${item.id}`} className="text-sm font-medium text-white hover:text-forge-accent">
                  {item.prompt}
                </Link>
                <p className="mt-1 text-xs text-zinc-500 capitalize">
                  {item.mode}
                  {item.creator_username ? (
                    <>
                      {' '}
                      • by{' '}
                      <Link to={`/u/${item.creator_username}`} className="text-forge-accent hover:underline">
                        @{item.creator_username}
                      </Link>
                    </>
                  ) : null}
                </p>

                {item.output_url && (
                  <audio
                    ref={(node) => {
                      audioRefs.current[item.id] = node;
                    }}
                    controls
                    src={item.output_url}
                    className="mt-3 w-full"
                    preload="none"
                    onPlay={() => {
                      void recordPlay(item.id);
                    }}
                  />
                )}

                <div className="mt-3 flex items-center justify-between text-xs text-zinc-400">
                  <span>
                    {item.play_count} plays • {item.like_count} likes • {item.share_count} shares
                  </span>
                  <button
                    type="button"
                    disabled={activeLikeId === item.id}
                    onClick={() => void handleLikeToggle(item)}
                    className="rounded-md border border-zinc-700 px-2 py-1 text-zinc-300 hover:bg-zinc-800 disabled:opacity-60"
                  >
                    {item.viewer_has_liked ? 'Unlike' : 'Like'}
                  </button>
                </div>

                {item.parent_generation_id && (
                  <p className="mt-2 text-xs text-zinc-500">
                    Remix lineage:{' '}
                    <Link
                      to={`/g/${item.parent_generation_id}`}
                      className="text-forge-accent hover:underline"
                    >
                      original track
                    </Link>
                  </p>
                )}
              </article>
            ))}

            {displayItems.length === 0 && (
              <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-400">
                No public generations yet. Be the first creator to share.
              </div>
            )}
          </section>

          <div ref={sentinelRef} className="mt-6 h-8 w-full" />

          {isLoadingMore && (
            <div className="mt-2 text-center text-xs text-zinc-500">Loading more tracks...</div>
          )}

          {!isLoadingMore && hasMore && (
            <div className="mt-2 text-center">
              <button
                type="button"
                onClick={() => void loadNextPage()}
                className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800"
              >
                Load more
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
