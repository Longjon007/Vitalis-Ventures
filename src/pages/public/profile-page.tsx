import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { trackEvent } from '../../core/analytics/tracker';
import { sortByTrending } from '../../core/ranking/trending';
import { buildReferralSignupLink } from '../../core/referrals/referral';
import { setPageMeta } from '../../core/seo/meta';
import {
  getPublicProfile,
  listPublicGenerations,
  type PublicGenerationRecord,
  type PublicProfileRecord,
} from '../../core/supabase/public';
import { getErrorMessage } from '../../core/utils/errors';

const FALLBACK_OG_IMAGE = 'https://musicforge.app/og-default.png';

function getCreatorBadge(score: number): string | null {
  if (score >= 500) return 'Top Creator';
  if (score >= 120) return 'Rising Creator';
  return null;
}

export default function ProfilePage() {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<PublicProfileRecord | null>(null);
  const [generations, setGenerations] = useState<PublicGenerationRecord[]>([]);

  useEffect(() => {
    const targetUsername = (username ?? '').trim();
    if (!targetUsername) {
      setError('Missing username.');
      setIsLoading(false);
      return;
    }

    let active = true;
    setError(null);
    setIsLoading(true);

    void (async () => {
      try {
        const [profileRow, generationRows] = await Promise.all([
          getPublicProfile(targetUsername),
          listPublicGenerations({ username: targetUsername, limit: 60, offset: 0 }),
        ]);

        if (!active) return;

        if (!profileRow) {
          setProfile(null);
          setGenerations([]);
          setError('Creator profile not found.');
          return;
        }

        setProfile(profileRow);
        setGenerations(generationRows);
        trackEvent('profile_view', { username: profileRow.username });
      } catch (err) {
        if (!active) return;
        setError(getErrorMessage(err, 'Unable to load profile.'));
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [username]);

  useEffect(() => {
    if (!profile) {
      setPageMeta({
        title: 'MusicForge Creator',
        description: 'Discover AI music creators on MusicForge.',
        image: FALLBACK_OG_IMAGE,
      });
      return;
    }

    const url =
      typeof window !== 'undefined' ? `${window.location.origin}/u/${profile.username}` : undefined;
    setPageMeta({
      title: `@${profile.username} on MusicForge`,
      description: profile.bio || `Explore AI-generated tracks by @${profile.username} on MusicForge.`,
      url,
      image: FALLBACK_OG_IMAGE,
    });
  }, [profile]);

  const signupHref = buildReferralSignupLink(profile?.referral_code ?? '', 'profile_page');
  const displayName = useMemo(() => {
    if (!profile) return '';
    return profile.display_name || `@${profile.username}`;
  }, [profile]);

  const topTracks = useMemo(() => sortByTrending(generations).slice(0, 3), [generations]);
  const recentTracks = useMemo(() => generations.slice(0, 8), [generations]);
  const creatorBadge = useMemo(() => getCreatorBadge(profile?.creator_score ?? 0), [profile?.creator_score]);

  function handleSignupClick() {
    trackEvent('public_to_signup_click', {
      source: 'profile_page',
      username: profile?.username,
      referralCode: profile?.referral_code ?? undefined,
    });
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-10">
      {isLoading && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-5 text-sm text-zinc-300">
          Loading creator profile...
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

      {!isLoading && profile && (
        <div className="space-y-6">
          <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
            <p className="text-xs uppercase tracking-wide text-zinc-500">Creator profile</p>
            <h1 className="mt-2 text-2xl font-semibold text-white">{displayName}</h1>
            <p className="mt-1 text-sm text-zinc-400">@{profile.username}</p>
            {creatorBadge && (
              <span className="mt-2 inline-flex rounded-full border border-forge-accent/40 bg-forge-accent/10 px-3 py-1 text-xs font-medium text-forge-accent">
                {creatorBadge}
              </span>
            )}
            {profile.bio && <p className="mt-3 text-sm text-zinc-300">{profile.bio}</p>}

            <div className="mt-4 grid gap-2 text-xs text-zinc-400 sm:grid-cols-3">
              <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2">
                {profile.generation_count} public generations
              </div>
              <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2">
                {profile.total_likes} total likes
              </div>
              <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2">
                {profile.total_plays} total plays
              </div>
              <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2">
                {profile.active_listing_count} active listings
              </div>
            </div>

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
                Explore all creators
              </Link>
            </div>
          </section>

          <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
            <h2 className="text-lg font-medium text-white">Top tracks</h2>
            {topTracks.length === 0 && (
              <p className="mt-3 text-sm text-zinc-400">No public generations yet.</p>
            )}
            {topTracks.length > 0 && (
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                {topTracks.map((item) => (
                  <article key={item.id} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
                    <Link to={`/g/${item.id}`} className="text-sm font-medium text-white hover:text-forge-accent">
                      {item.prompt}
                    </Link>
                    <p className="mt-1 text-xs text-zinc-500">
                      {item.play_count} plays • {item.like_count} likes
                    </p>
                    {item.output_url && (
                      <audio controls src={item.output_url} className="mt-3 w-full" preload="none" />
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
            <h2 className="text-lg font-medium text-white">Recent tracks</h2>

            {recentTracks.length === 0 && (
              <p className="mt-3 text-sm text-zinc-400">No public generations yet.</p>
            )}

            {recentTracks.length > 0 && (
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {recentTracks.map((item) => (
                  <article key={item.id} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
                    <Link to={`/g/${item.id}`} className="text-sm font-medium text-white hover:text-forge-accent">
                      {item.prompt}
                    </Link>
                    <p className="mt-1 text-xs text-zinc-500 capitalize">
                      {item.mode} • {item.play_count} plays
                    </p>
                    {item.output_url && (
                      <audio controls src={item.output_url} className="mt-3 w-full" preload="none" />
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
