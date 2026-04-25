import { describe, expect, it, vi } from 'vitest';
import { createUpstashRateLimiter } from '../src/rate-limit/upstash-rate-limiter.js';

describe('upstash rate limiter', () => {
  it('uses the Upstash REST eval command without touching the network directly', async () => {
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ result: [1, 7, 1_700_000_060_000] })
    });
    const limiter = createUpstashRateLimiter({
      url: 'https://example-upstash.upstash.io',
      token: 'secret-token',
      fetch
    });

    await expect(
      limiter.consume({
        key: 'tenant:b:tpm',
        limit: 20,
        windowMs: 60_000,
        cost: 7,
        now: 1_700_000_000_000
      })
    ).resolves.toEqual({
      allowed: true,
      remaining: 13,
      resetAt: '2023-11-14T22:14:20.000Z'
    });

    expect(fetch).toHaveBeenCalledWith('https://example-upstash.upstash.io', {
      method: 'POST',
      headers: {
        authorization: 'Bearer secret-token',
        'content-type': 'application/json'
      },
      body: expect.any(String)
    });
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual([
      'EVAL',
      expect.any(String),
      '1',
      'tenant:b:tpm',
      '20',
      '7',
      '60000',
      '1700000000000'
    ]);
  });

  it('allows unlimited requests without calling Upstash when limit is null', async () => {
    const fetch = vi.fn();
    const limiter = createUpstashRateLimiter({
      url: 'https://example-upstash.upstash.io',
      token: 'secret-token',
      fetch
    });

    await expect(
      limiter.consume({
        key: 'tenant:b:rpm',
        limit: null,
        windowMs: 60_000,
        now: 1_700_000_000_000
      })
    ).resolves.toEqual({
      allowed: true,
      remaining: Number.POSITIVE_INFINITY,
      resetAt: '2023-11-14T22:14:20.000Z'
    });
    expect(fetch).not.toHaveBeenCalled();
  });
});
