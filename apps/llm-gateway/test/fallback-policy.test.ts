import { describe, expect, it } from 'vitest';
import { GatewayError, type GatewayErrorCode } from '../src/gateway/errors.js';
import { isFallbackEligible } from '../src/gateway/fallback-policy.js';
import { GatewayProviderError } from '../src/providers/provider-adapter.js';

describe('fallback policy', () => {
  it('allows fallback for provider availability, timeout, rate limit, and malformed response failures', () => {
    const eligibleCodes: GatewayErrorCode[] = [
      'UPSTREAM_TIMEOUT',
      'UPSTREAM_RATE_LIMITED',
      'UPSTREAM_UNAVAILABLE',
      'UPSTREAM_BAD_RESPONSE'
    ];

    expect(eligibleCodes.map(code => isFallbackEligible(new GatewayError(code, code, 503)))).toEqual([
      true,
      true,
      true,
      true
    ]);
    expect(isFallbackEligible(new GatewayProviderError())).toBe(true);
  });

  it('blocks fallback for auth, key, gateway rate limiter, budget, and request policy failures', () => {
    const blockedCodes: GatewayErrorCode[] = [
      'AUTH_ERROR',
      'KEY_DISABLED',
      'KEY_REVOKED',
      'KEY_EXPIRED',
      'MODEL_NOT_FOUND',
      'MODEL_NOT_ALLOWED',
      'RATE_LIMITED',
      'RATE_LIMITER_UNAVAILABLE',
      'BUDGET_EXCEEDED',
      'CONTEXT_TOO_LONG',
      'UPSTREAM_AUTH_ERROR'
    ];

    expect(blockedCodes.map(code => isFallbackEligible(new GatewayError(code, code, 429)))).toEqual(
      blockedCodes.map(() => false)
    );
  });

  it('fails closed for unknown errors', () => {
    expect(isFallbackEligible(new Error('boom'))).toBe(false);
    expect(isFallbackEligible({ code: 'UPSTREAM_TIMEOUT' })).toBe(false);
  });
});
