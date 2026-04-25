import type { RateLimitConsumeInput, RateLimitConsumeResult, RateLimiter } from './rate-limiter';
import {
  REDIS_FIXED_WINDOW_SCRIPT,
  createUnlimitedResult,
  toConsumeResult,
  wrapRateLimiterError
} from './redis-rate-limiter';

interface UpstashResponse {
  ok: boolean;
  status?: number;
  json(): Promise<unknown>;
  text?(): Promise<string>;
}

export type UpstashFetch = (
  input: string,
  init: {
    method: 'POST';
    headers: Record<string, string>;
    body: string;
  }
) => Promise<UpstashResponse>;

export interface UpstashRateLimiterOptions {
  url: string;
  token: string;
  fetch?: UpstashFetch;
}

export function createUpstashRateLimiter(options: UpstashRateLimiterOptions): RateLimiter {
  const fetcher = options.fetch ?? globalThis.fetch;

  return {
    async consume(input: RateLimitConsumeInput): Promise<RateLimitConsumeResult> {
      if (input.limit === null || input.limit === undefined) {
        return createUnlimitedResult(input);
      }

      try {
        const now = input.now ?? Date.now();
        const response = await fetcher(options.url, {
          method: 'POST',
          headers: {
            authorization: `Bearer ${options.token}`,
            'content-type': 'application/json'
          },
          body: JSON.stringify([
            'EVAL',
            REDIS_FIXED_WINDOW_SCRIPT,
            '1',
            input.key,
            String(input.limit),
            String(input.cost ?? 1),
            String(input.windowMs),
            String(now)
          ])
        });

        if (!response.ok) {
          throw wrapRateLimiterError(await response.text?.(), response.status);
        }

        const payload = await response.json();
        return toConsumeResult(readUpstashResult(payload), input.limit);
      } catch (error) {
        throw wrapRateLimiterError(error);
      }
    }
  };
}

function readUpstashResult(payload: unknown): unknown {
  if (typeof payload !== 'object' || payload === null) {
    throw wrapRateLimiterError(new Error('Upstash returned an invalid response'));
  }

  if ('error' in payload && payload.error) {
    throw wrapRateLimiterError(payload.error);
  }

  if (!('result' in payload)) {
    throw wrapRateLimiterError(new Error('Upstash response did not include result'));
  }

  return payload.result;
}
