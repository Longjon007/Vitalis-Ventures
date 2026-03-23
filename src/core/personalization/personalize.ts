import { calculateTrendingScore, type TrendingSignal } from '../ranking/trending';

type TrackLike = {
  id: string;
  input_params: Record<string, unknown>;
};

type PersonalizationCandidate = TrendingSignal & TrackLike;

export type PersonalizationProfile = {
  topGenres: string[];
  avgBpm: number | null;
};

function normalizeGenre(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  return normalized || null;
}

function normalizeBpm(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return null;
}

function getGenre(item: TrackLike): string | null {
  return normalizeGenre(item.input_params.genre);
}

function getBpm(item: TrackLike): number | null {
  return normalizeBpm(item.input_params.bpm);
}

function getTopGenres(items: TrackLike[], max = 3): string[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    const genre = getGenre(item);
    if (!genre) continue;
    counts.set(genre, (counts.get(genre) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([genre]) => genre);
}

function getAverageBpm(items: TrackLike[]): number | null {
  const bpms = items
    .map(getBpm)
    .filter((value): value is number => value !== null);

  if (bpms.length === 0) return null;
  const total = bpms.reduce((sum, bpm) => sum + bpm, 0);
  return total / bpms.length;
}

function genreAffinityScore(profile: PersonalizationProfile, candidate: TrackLike): number {
  if (profile.topGenres.length === 0) return 0;
  const genre = getGenre(candidate);
  if (!genre) return 0;
  const index = profile.topGenres.indexOf(genre);
  if (index === -1) return 0;
  return Math.max(1, 6 - index * 2);
}

function bpmAffinityScore(profile: PersonalizationProfile, candidate: TrackLike): number {
  if (!profile.avgBpm) return 0;
  const bpm = getBpm(candidate);
  if (!bpm) return 0;
  const delta = Math.abs(profile.avgBpm - bpm);
  if (delta >= 50) return 0;
  return (1 - delta / 50) * 4;
}

export function buildPersonalizationProfile(
  history: TrackLike[],
  liked: TrackLike[] = [],
): PersonalizationProfile {
  const combined = [...liked, ...history];
  return {
    topGenres: getTopGenres(combined),
    avgBpm: getAverageBpm(combined),
  };
}

export function personalizeFeed<T extends PersonalizationCandidate>(
  feed: T[],
  profile: PersonalizationProfile,
): T[] {
  const now = Date.now();
  return [...feed].sort((a, b) => {
    const aScore =
      calculateTrendingScore(a, now) +
      genreAffinityScore(profile, a) +
      bpmAffinityScore(profile, a);
    const bScore =
      calculateTrendingScore(b, now) +
      genreAffinityScore(profile, b) +
      bpmAffinityScore(profile, b);
    return bScore - aScore;
  });
}
