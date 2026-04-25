export interface RateLimitConsumeInput {
  key: string;
  limit?: number | null;
  windowMs: number;
  cost?: number;
  now?: number;
}

export interface RateLimitConsumeResult {
  allowed: boolean;
  remaining: number;
  resetAt: string;
}

export interface RateLimiter {
  consume(input: RateLimitConsumeInput): Promise<RateLimitConsumeResult>;
}

export const RATE_LIMITER_UNAVAILABLE = 'RATE_LIMITER_UNAVAILABLE' as const;

export class RateLimiterUnavailableError extends Error {
  readonly code = RATE_LIMITER_UNAVAILABLE;
  readonly cause?: unknown;
  readonly status?: number;

  constructor(message: string, options?: { cause?: unknown; status?: number }) {
    super(message);
    this.name = 'RateLimiterUnavailableError';
    this.cause = options?.cause;
    this.status = options?.status ?? 503;
  }
}

export function isRateLimiterUnavailableError(error: unknown): error is RateLimiterUnavailableError {
  return (
    error instanceof RateLimiterUnavailableError ||
    (typeof error === 'object' && error !== null && 'code' in error && error.code === RATE_LIMITER_UNAVAILABLE)
  );
}
