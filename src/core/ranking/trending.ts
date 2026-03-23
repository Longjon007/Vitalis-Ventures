const LIKE_WEIGHT = 3;
const PLAY_WEIGHT = 1;
const SHARE_WEIGHT = 4;
const RECENCY_MAX_BOOST = 6;
const RECENCY_WINDOW_HOURS = 72;

export type TrendingSignal = {
  like_count: number;
  play_count: number;
  share_count: number;
  created_at: string;
};

function toNonNegative(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  return value;
}

function parseTimestamp(value: string): number {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return Date.now();
  return timestamp;
}

export function calculateRecencyBoost(createdAt: string, now = Date.now()): number {
  const createdTimestamp = parseTimestamp(createdAt);
  const ageMs = Math.max(0, now - createdTimestamp);
  const ageHours = ageMs / (1000 * 60 * 60);

  if (ageHours >= RECENCY_WINDOW_HOURS) return 0;

  const freshnessRatio = 1 - ageHours / RECENCY_WINDOW_HOURS;
  return freshnessRatio * RECENCY_MAX_BOOST;
}

export function calculateTrendingScore(signal: TrendingSignal, now = Date.now()): number {
  const likes = toNonNegative(signal.like_count);
  const plays = toNonNegative(signal.play_count);
  const shares = toNonNegative(signal.share_count);
  const recencyBoost = calculateRecencyBoost(signal.created_at, now);

  return likes * LIKE_WEIGHT + plays * PLAY_WEIGHT + shares * SHARE_WEIGHT + recencyBoost;
}

export function sortByTrending<T extends TrendingSignal>(items: T[], now = Date.now()): T[] {
  return [...items].sort((a, b) => {
    const scoreDelta = calculateTrendingScore(b, now) - calculateTrendingScore(a, now);
    if (scoreDelta !== 0) return scoreDelta;
    return parseTimestamp(b.created_at) - parseTimestamp(a.created_at);
  });
}
