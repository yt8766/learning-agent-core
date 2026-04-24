import { describe, expect, it } from 'vitest';
import { createMemoryRateLimiter } from '../src/rate-limit/memory-rate-limiter.js';
import { estimateCompletionCost, estimateRequestTokens, isDailyBudgetAvailable } from '../src/usage/usage-meter.js';

describe('rate limits and usage', () => {
  it('rejects the second request when rpm limit is one', async () => {
    const limiter = createMemoryRateLimiter();

    await expect(limiter.consume({ key: 'key_1', limit: 1, windowMs: 60_000 })).resolves.toMatchObject({
      allowed: true
    });
    await expect(limiter.consume({ key: 'key_1', limit: 1, windowMs: 60_000 })).resolves.toMatchObject({
      allowed: false
    });
  });

  it('estimates request tokens conservatively', () => {
    expect(estimateRequestTokens([{ role: 'user', content: 'hello world' }])).toBeGreaterThan(0);
  });

  it('rejects unavailable daily budget', () => {
    expect(isDailyBudgetAvailable({ used: 100, limit: 100, estimated: 1 })).toBe(false);
  });

  it('estimates model cost from input and output token prices', () => {
    expect(
      estimateCompletionCost({
        promptTokens: 1_000_000,
        completionTokens: 500_000,
        inputPricePer1mTokens: 1,
        outputPricePer1mTokens: 2
      })
    ).toBe(2);
  });
});
