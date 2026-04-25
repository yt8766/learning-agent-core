import { describe, expect, it, vi } from 'vitest';
import { createRedisRateLimiter } from '../src/rate-limit/redis-rate-limiter.js';

describe('redis rate limiter', () => {
  it('allows unlimited requests without calling redis when limit is null', async () => {
    const client = {
      eval: vi.fn()
    };
    const limiter = createRedisRateLimiter({ client });

    await expect(
      limiter.consume({
        key: 'tenant:a:rpm',
        limit: null,
        windowMs: 60_000,
        now: 1_700_000_000_000
      })
    ).resolves.toEqual({
      allowed: true,
      remaining: Number.POSITIVE_INFINITY,
      resetAt: '2023-11-14T22:14:20.000Z'
    });
    expect(client.eval).not.toHaveBeenCalled();
  });

  it('passes cost to the fixed-window script and maps remaining/resetAt', async () => {
    const client = {
      eval: vi.fn().mockResolvedValue([1, 4, 1_700_000_060_000])
    };
    const limiter = createRedisRateLimiter({ client, keyPrefix: 'llm-gateway' });

    await expect(
      limiter.consume({
        key: 'tenant:a:tpm',
        limit: 10,
        windowMs: 60_000,
        cost: 4,
        now: 1_700_000_000_000
      })
    ).resolves.toEqual({
      allowed: true,
      remaining: 6,
      resetAt: '2023-11-14T22:14:20.000Z'
    });
    expect(client.eval).toHaveBeenCalledWith(
      expect.any(String),
      ['llm-gateway:tenant:a:tpm'],
      ['10', '4', '60000', '1700000000000']
    );
  });

  it('rejects without negative remaining when redis reports the bucket is full', async () => {
    const client = {
      eval: vi.fn().mockResolvedValue([0, 10, 1_700_000_060_000])
    };
    const limiter = createRedisRateLimiter({ client });

    await expect(
      limiter.consume({
        key: 'tenant:a:rpm',
        limit: 10,
        windowMs: 60_000,
        cost: 2,
        now: 1_700_000_000_000
      })
    ).resolves.toEqual({
      allowed: false,
      remaining: 0,
      resetAt: '2023-11-14T22:14:20.000Z'
    });
  });
});
