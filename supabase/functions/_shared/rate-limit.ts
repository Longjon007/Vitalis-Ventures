type RateLimitBucket = {
  count: number;
  resetAt: number;
};

type RateLimitOptions = {
  namespace: string;
  identifier: string;
  limit: number;
  windowMs: number;
};

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
  headers: HeadersInit;
};

// NOTE: This limiter is in-memory per edge runtime instance.
// It is intentionally lightweight for launch hardening, but not globally durable.
// For strict distributed enforcement, back this with a shared Redis/KV store.
const buckets = new Map<string, RateLimitBucket>();
let lastCleanupAt = 0;

function nowMs(): number {
  return Date.now();
}

function cleanupExpiredBuckets(currentTime: number): void {
  if (currentTime - lastCleanupAt < 60_000) return;
  lastCleanupAt = currentTime;

  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= currentTime) {
      buckets.delete(key);
    }
  }
}

function buildHeaders(
  limit: number,
  remaining: number,
  resetAt: number,
  retryAfterSeconds: number,
): HeadersInit {
  return {
    'X-RateLimit-Limit': String(limit),
    'X-RateLimit-Remaining': String(Math.max(0, remaining)),
    'X-RateLimit-Reset': String(Math.floor(resetAt / 1000)),
    'Retry-After': String(Math.max(1, retryAfterSeconds)),
  };
}

export function getClientIp(req: Request): string {
  const forwardedFor = req.headers.get('x-forwarded-for');
  if (forwardedFor) {
    const first = forwardedFor.split(',')[0]?.trim();
    if (first) return first;
  }

  const realIp = req.headers.get('x-real-ip');
  if (realIp?.trim()) return realIp.trim();

  const cfIp = req.headers.get('cf-connecting-ip');
  if (cfIp?.trim()) return cfIp.trim();

  return 'unknown';
}

export function applyRateLimit(options: RateLimitOptions): RateLimitResult {
  const currentTime = nowMs();
  cleanupExpiredBuckets(currentTime);

  const key = `${options.namespace}:${options.identifier}`;
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= currentTime) {
    const resetAt = currentTime + options.windowMs;
    buckets.set(key, { count: 1, resetAt });
    return {
      allowed: true,
      limit: options.limit,
      remaining: options.limit - 1,
      resetAt,
      retryAfterSeconds: Math.ceil(options.windowMs / 1000),
      headers: buildHeaders(
        options.limit,
        options.limit - 1,
        resetAt,
        Math.ceil(options.windowMs / 1000),
      ),
    };
  }

  existing.count += 1;

  const remaining = options.limit - existing.count;
  const retryAfterSeconds = Math.ceil((existing.resetAt - currentTime) / 1000);

  if (existing.count > options.limit) {
    return {
      allowed: false,
      limit: options.limit,
      remaining: 0,
      resetAt: existing.resetAt,
      retryAfterSeconds,
      headers: buildHeaders(options.limit, 0, existing.resetAt, retryAfterSeconds),
    };
  }

  return {
    allowed: true,
    limit: options.limit,
    remaining,
    resetAt: existing.resetAt,
    retryAfterSeconds,
    headers: buildHeaders(options.limit, remaining, existing.resetAt, retryAfterSeconds),
  };
}
