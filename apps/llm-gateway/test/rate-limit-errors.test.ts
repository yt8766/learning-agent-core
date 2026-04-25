import { describe, expect, it, vi } from 'vitest';
import {
  RATE_LIMITER_UNAVAILABLE,
  RateLimiterUnavailableError,
  createRedisRateLimiter,
  isRateLimiterUnavailableError
} from '../src/rate-limit/redis-rate-limiter.js';
import { createUpstashRateLimiter } from '../src/rate-limit/upstash-rate-limiter.js';

describe('rate limiter errors', () => {
  it('wraps redis client failures in a stable unavailable error', async () => {
    const cause = new Error('redis down');
    const limiter = createRedisRateLimiter({
      client: {
        eval: vi.fn().mockRejectedValue(cause)
      }
    });

    await expect(
      limiter.consume({
        key: 'tenant:a:rpm',
        limit: 1,
        windowMs: 60_000
      })
    ).rejects.toMatchObject({
      code: RATE_LIMITER_UNAVAILABLE,
      cause
    });
  });

  it('exposes a typed guard for RATE_LIMITER_UNAVAILABLE', () => {
    const error = new RateLimiterUnavailableError('Rate limiter unavailable');

    expect(isRateLimiterUnavailableError(error)).toBe(true);
    expect(isRateLimiterUnavailableError(new Error('other'))).toBe(false);
  });

  it('wraps Upstash REST failures in the same stable error', async () => {
    const limiter = createUpstashRateLimiter({
      url: 'https://example-upstash.upstash.io',
      token: 'secret-token',
      fetch: vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        text: async () => 'unavailable'
      })
    });

    await expect(
      limiter.consume({
        key: 'tenant:b:rpm',
        limit: 1,
        windowMs: 60_000
      })
    ).rejects.toMatchObject({
      code: RATE_LIMITER_UNAVAILABLE,
      status: 503
    });
  });
});
