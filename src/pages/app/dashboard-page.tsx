import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { recommendGenerations } from '../../core/recommendation/recommend';
import { listGenerations, type GenerationRecord } from '../../core/supabase/generations';
import { listPublicGenerations, type PublicGenerationRecord } from '../../core/supabase/public';
import { getErrorMessage } from '../../core/utils/errors';

export default function DashboardPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generations, setGenerations] = useState<GenerationRecord[]>([]);
  const [publicFeed, setPublicFeed] = useState<PublicGenerationRecord[]>([]);

  useEffect(() => {
    let active = true;
    setError(null);
    setIsLoading(true);

    void (async () => {
      try {
        const [generationRows, publicRows] = await Promise.all([
          listGenerations(),
          listPublicGenerations({ limit: 30, offset: 0 }),
        ]);

        if (!active) return;
        setGenerations(generationRows);
        setPublicFeed(publicRows);
      } catch (err) {
        if (!active) return;
        setError(getErrorMessage(err, 'Unable to load dashboard data.'));
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

  const lastTrack = useMemo(() => {
    return generations.find((item) => item.status === 'completed') ?? generations[0] ?? null;
  }, [generations]);

  const suggested = useMemo(() => {
    if (publicFeed.length === 0) return [];
    if (!lastTrack) return publicFeed.slice(0, 4);
    return recommendGenerations(lastTrack, publicFeed, 4);
  }, [lastTrack, publicFeed]);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
        <h1 className="text-2xl font-semibold text-white">Dashboard</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Pick up where you left off, remix recent ideas, and stay in your creation rhythm.
        </p>
      </section>

      {isLoading && (
        <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 text-sm text-zinc-300">
          Loading your workspace...
        </section>
      )}

      {!isLoading && error && (
        <section className="rounded-2xl border border-red-900 bg-red-950/30 p-6 text-sm text-red-300">
          {error}
        </section>
      )}

      {!isLoading && !error && (
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
            <h2 className="text-lg font-medium text-white">Your last track</h2>
            {!lastTrack && (
              <p className="mt-3 text-sm text-zinc-400">
                No generations yet. Start your first track from the create workspace.
              </p>
            )}
            {lastTrack && (
              <>
                <p className="mt-3 text-sm text-zinc-200">{lastTrack.prompt || 'Untitled generation'}</p>
                <p className="mt-1 text-xs text-zinc-500 capitalize">
                  {lastTrack.mode} • {lastTrack.status}
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <Link
                    to="/app/create"
                    className="rounded-lg bg-forge-accent px-4 py-2 text-sm font-medium text-white hover:bg-forge-accent-hover"
                  >
                    Continue creating
                  </Link>
                  {lastTrack.status === 'completed' && (
                    <Link
                      to={`/app/create?remix=${lastTrack.id}`}
                      className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
                    >
                      Remix your last track
                    </Link>
                  )}
                  <Link
                    to="/app/create"
                    className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
                  >
                    Regenerate variation
                  </Link>
                </div>
              </>
            )}
          </section>

          <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
            <h2 className="text-lg font-medium text-white">You might like</h2>
            <p className="mt-2 text-xs text-zinc-500">
              Based on your recent activity and what is trending in Explore.
            </p>
            {suggested.length === 0 && (
              <p className="mt-3 text-sm text-zinc-400">Recommendations will appear as public tracks grow.</p>
            )}
            {suggested.length > 0 && (
              <div className="mt-4 space-y-3">
                {suggested.map((item) => (
                  <article key={item.id} className="rounded-xl border border-zinc-800 bg-zinc-900 p-3">
                    <Link to={`/g/${item.id}`} className="text-sm font-medium text-white hover:text-forge-accent">
                      {item.prompt}
                    </Link>
                    <p className="mt-1 text-xs text-zinc-500">
                      {item.play_count} plays • {item.like_count} likes
                    </p>
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
