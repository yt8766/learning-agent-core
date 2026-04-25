import { describe, expect, it } from 'vitest';
import { buildInvocationLog } from '../src/usage/invocation-log.js';

describe('invocation log', () => {
  it('builds a success request log with normalized model, usage, cost, stream, and fallback fields', () => {
    const log = buildInvocationLog({
      keyId: 'key_1',
      requestedModel: 'gpt-main',
      model: 'cheap-fast',
      providerModel: 'mock-cheap-fast',
      provider: 'fallback',
      status: 'success',
      usage: {
        prompt_tokens: 120,
        completion_tokens: 30,
        total_tokens: 150
      },
      estimatedCost: 0.00018,
      usageSource: 'provider_final_usage',
      latencyMs: 37,
      stream: false,
      fallbackAttemptCount: 1
    });

    expect(log).toEqual({
      keyId: 'key_1',
      requestedModel: 'gpt-main',
      model: 'cheap-fast',
      providerModel: 'mock-cheap-fast',
      provider: 'fallback',
      status: 'success',
      promptTokens: 120,
      completionTokens: 30,
      totalTokens: 150,
      estimatedCost: 0.00018,
      usageSource: 'provider_final_usage',
      latencyMs: 37,
      stream: false,
      fallbackAttemptCount: 1
    });
  });

  it('builds an error request log without copying prompt or completion text', () => {
    const log = buildInvocationLog({
      keyId: 'key_1',
      requestedModel: 'gpt-main',
      model: 'gpt-main',
      providerModel: 'mock-model',
      provider: 'mock',
      status: 'error',
      usage: {
        prompt_tokens: 16,
        completion_tokens: 0,
        total_tokens: 16
      },
      estimatedCost: 0.000016,
      usageSource: 'gateway_estimated_usage',
      latencyMs: 12,
      stream: true,
      fallbackAttemptCount: 2,
      errorCode: 'UPSTREAM_TIMEOUT',
      errorMessage: 'upstream timed out',
      prompt: 'do not persist this prompt',
      completion: 'do not persist this completion'
    } as never);

    expect(log).toMatchObject({
      keyId: 'key_1',
      requestedModel: 'gpt-main',
      model: 'gpt-main',
      providerModel: 'mock-model',
      provider: 'mock',
      status: 'error',
      promptTokens: 16,
      completionTokens: 0,
      totalTokens: 16,
      estimatedCost: 0.000016,
      usageSource: 'gateway_estimated_usage',
      latencyMs: 12,
      stream: true,
      fallbackAttemptCount: 2,
      errorCode: 'UPSTREAM_TIMEOUT',
      errorMessage: 'upstream timed out'
    });
    expect(JSON.stringify(log)).not.toContain('do not persist this prompt');
    expect(JSON.stringify(log)).not.toContain('do not persist this completion');
  });
});
