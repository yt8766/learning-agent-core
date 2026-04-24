import type { RateLimitConsumeInput, RateLimitConsumeResult, RateLimiter } from './rate-limiter';

interface Bucket {
  count: number;
  resetAtMs: number;
}

export function createMemoryRateLimiter(): RateLimiter {
  const buckets = new Map<string, Bucket>();

  return {
    async consume(input: RateLimitConsumeInput): Promise<RateLimitConsumeResult> {
      const limit = input.limit;
      const now = input.now ?? Date.now();
      const cost = input.cost ?? 1;

      if (limit === null || limit === undefined) {
        return {
          allowed: true,
          remaining: Number.POSITIVE_INFINITY,
          resetAt: new Date(now + input.windowMs).toISOString()
        };
      }

      const existing = buckets.get(input.key);
      const bucket =
        existing && existing.resetAtMs > now
          ? existing
          : {
              count: 0,
              resetAtMs: now + input.windowMs
            };

      const nextCount = bucket.count + cost;
      const allowed = nextCount <= limit;

      if (allowed) {
        bucket.count = nextCount;
        buckets.set(input.key, bucket);
      } else if (!existing || existing.resetAtMs <= now) {
        buckets.set(input.key, bucket);
      }

      return {
        allowed,
        remaining: Math.max(0, limit - bucket.count),
        resetAt: new Date(bucket.resetAtMs).toISOString()
      };
    }
  };
}
