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
