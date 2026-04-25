import type { RateLimitConsumeInput, RateLimitConsumeResult, RateLimiter } from './rate-limiter';
import { RATE_LIMITER_UNAVAILABLE, RateLimiterUnavailableError, isRateLimiterUnavailableError } from './rate-limiter';

export { RATE_LIMITER_UNAVAILABLE, RateLimiterUnavailableError, isRateLimiterUnavailableError };

export interface RedisRateLimitClient {
  eval(script: string, keys: string[], args: string[]): Promise<unknown>;
}

export interface RedisRateLimiterOptions {
  client: RedisRateLimitClient;
  keyPrefix?: string;
}

export const REDIS_FIXED_WINDOW_SCRIPT = `
local key = KEYS[1]
local limit = tonumber(ARGV[1])
local cost = tonumber(ARGV[2])
local windowMs = tonumber(ARGV[3])
local now = tonumber(ARGV[4])

local current = tonumber(redis.call("GET", key) or "0")
local ttl = redis.call("PTTL", key)
local resetAt = now + ttl

if ttl < 0 then
  current = 0
  resetAt = now + windowMs
end

if current + cost > limit then
  return {0, current, resetAt}
end

local nextCount = redis.call("INCRBY", key, cost)
if ttl < 0 then
  redis.call("PEXPIRE", key, windowMs)
end

return {1, nextCount, resetAt}
`;

export function createRedisRateLimiter(options: RedisRateLimiterOptions): RateLimiter {
  return {
    async consume(input: RateLimitConsumeInput): Promise<RateLimitConsumeResult> {
      if (input.limit === null || input.limit === undefined) {
        return createUnlimitedResult(input);
      }

      const now = input.now ?? Date.now();
      const cost = input.cost ?? 1;
      const key = options.keyPrefix ? `${options.keyPrefix}:${input.key}` : input.key;

      try {
        const rawResult = await options.client.eval(
          REDIS_FIXED_WINDOW_SCRIPT,
          [key],
          [String(input.limit), String(cost), String(input.windowMs), String(now)]
        );
        return toConsumeResult(rawResult, input.limit);
      } catch (error) {
        throw wrapRateLimiterError(error);
      }
    }
  };
}

export function createUnlimitedResult(input: RateLimitConsumeInput): RateLimitConsumeResult {
  const now = input.now ?? Date.now();

  return {
    allowed: true,
    remaining: Number.POSITIVE_INFINITY,
    resetAt: new Date(now + input.windowMs).toISOString()
  };
}

export function toConsumeResult(rawResult: unknown, limit: number): RateLimitConsumeResult {
  if (!Array.isArray(rawResult) || rawResult.length < 3) {
    throw new RateLimiterUnavailableError('Rate limiter returned an invalid fixed-window result');
  }

  const allowedFlag = Number(rawResult[0]);
  const count = Number(rawResult[1]);
  const resetAtMs = Number(rawResult[2]);

  if (![allowedFlag, count, resetAtMs].every(Number.isFinite)) {
    throw new RateLimiterUnavailableError('Rate limiter returned a non-numeric fixed-window result');
  }

  return {
    allowed: allowedFlag === 1,
    remaining: Math.max(0, limit - count),
    resetAt: new Date(resetAtMs).toISOString()
  };
}

export function wrapRateLimiterError(error: unknown, status?: number): RateLimiterUnavailableError {
  if (isRateLimiterUnavailableError(error)) {
    return error;
  }

  return new RateLimiterUnavailableError('Rate limiter unavailable', { cause: error, status });
}
