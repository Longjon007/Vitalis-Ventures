import { calculateTrendingScore, type TrendingSignal } from '../ranking/trending';

export type RecommendationCandidate = TrendingSignal & {
  id: string;
  input_params: Record<string, unknown>;
};

type RecommendationSeed = {
  id: string;
  input_params: Record<string, unknown>;
};

function normalizeGenre(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  return normalized || null;
}

function normalizeBpm(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return null;
}

function getGenre(params: Record<string, unknown>): string | null {
  return normalizeGenre(params.genre);
}

function getBpm(params: Record<string, unknown>): number | null {
  return normalizeBpm(params.bpm);
}

function genreScore(seedGenre: string | null, candidateGenre: string | null): number {
  if (!seedGenre || !candidateGenre) return 0;
  return seedGenre === candidateGenre ? 8 : 0;
}

function bpmScore(seedBpm: number | null, candidateBpm: number | null): number {
  if (!seedBpm || !candidateBpm) return 0;
  const delta = Math.abs(seedBpm - candidateBpm);
  if (delta >= 40) return 0;
  return (1 - delta / 40) * 6;
}

export function recommendGenerations<T extends RecommendationCandidate>(
  seed: RecommendationSeed,
  candidates: T[],
  limit = 4,
): T[] {
  const seedGenre = getGenre(seed.input_params);
  const seedBpm = getBpm(seed.input_params);
  const now = Date.now();

  return [...candidates]
    .filter((candidate) => candidate.id !== seed.id)
    .sort((a, b) => {
      const aScore =
        genreScore(seedGenre, getGenre(a.input_params)) +
        bpmScore(seedBpm, getBpm(a.input_params)) +
        calculateTrendingScore(a, now);
      const bScore =
        genreScore(seedGenre, getGenre(b.input_params)) +
        bpmScore(seedBpm, getBpm(b.input_params)) +
        calculateTrendingScore(b, now);
      return bScore - aScore;
    })
    .slice(0, Math.max(1, limit));
}
