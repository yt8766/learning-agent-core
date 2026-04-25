import { describe, expect, it } from 'vitest';
import {
  calculateUsageCost,
  estimateStreamUsage,
  resolveFinalUsage,
  type UsageSource
} from '../src/usage/usage-accounting.js';

describe('usage accounting', () => {
  it('prefers provider final usage over stream accumulated usage and gateway estimates', () => {
    const result = resolveFinalUsage({
      providerUsage: {
        prompt_tokens: 10,
        completion_tokens: 20,
        total_tokens: 30
      },
      streamAccumulatedUsage: {
        prompt_tokens: 100,
        completion_tokens: 200,
        total_tokens: 300
      },
      gatewayEstimatedUsage: {
        prompt_tokens: 1,
        completion_tokens: 2,
        total_tokens: 3
      }
    });

    expect(result).toEqual({
      source: 'provider_final_usage' satisfies UsageSource,
      usage: {
        prompt_tokens: 10,
        completion_tokens: 20,
        total_tokens: 30
      }
    });
  });

  it('falls back to stream accumulated usage before gateway estimates', () => {
    const result = resolveFinalUsage({
      streamAccumulatedUsage: {
        prompt_tokens: 40,
        completion_tokens: 15,
        total_tokens: 55
      },
      gatewayEstimatedUsage: {
        prompt_tokens: 4,
        completion_tokens: 5,
        total_tokens: 9
      }
    });

    expect(result).toEqual({
      source: 'stream_accumulated_usage' satisfies UsageSource,
      usage: {
        prompt_tokens: 40,
        completion_tokens: 15,
        total_tokens: 55
      }
    });
  });

  it('uses gateway estimated usage when provider and stream usage are unavailable', () => {
    const result = resolveFinalUsage({
      gatewayEstimatedUsage: {
        prompt_tokens: 8,
        completion_tokens: 13,
        total_tokens: 21
      }
    });

    expect(result).toEqual({
      source: 'gateway_estimated_usage' satisfies UsageSource,
      usage: {
        prompt_tokens: 8,
        completion_tokens: 13,
        total_tokens: 21
      }
    });
  });

  it('estimates stream usage from messages and streamed content conservatively', () => {
    const usage = estimateStreamUsage({
      messages: [
        { role: 'system', content: 'Be concise.' },
        { role: 'user', content: 'Summarize this gateway usage event.' }
      ],
      streamedContent: 'A compact summary.'
    });

    expect(usage.prompt_tokens).toBeGreaterThan(0);
    expect(usage.completion_tokens).toBe(Math.ceil('A compact summary.'.length / 4) + 4);
    expect(usage.total_tokens).toBe(usage.prompt_tokens + usage.completion_tokens);
  });

  it('calculates usage cost with existing per-million token price semantics', () => {
    expect(
      calculateUsageCost({
        usage: {
          prompt_tokens: 1_000_000,
          completion_tokens: 500_000,
          total_tokens: 1_500_000
        },
        inputPricePer1mTokens: 1,
        outputPricePer1mTokens: 2
      })
    ).toBe(2);
  });
});
