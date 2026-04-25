import { describe, expect, it } from 'vitest';

import {
  AdminDashboardResponseSchema,
  AdminRequestLogListResponseSchema,
  AdminRequestLogQuerySchema
} from '../src/contracts/admin-logs.js';

describe('admin logs contracts', () => {
  it('parses request log query filters and defaults the limit', () => {
    const query = AdminRequestLogQuerySchema.parse({
      keyId: 'key_prod',
      model: 'gpt-main',
      provider: 'openai',
      status: 'error'
    });

    expect(query).toEqual({
      keyId: 'key_prod',
      model: 'gpt-main',
      provider: 'openai',
      status: 'error',
      limit: 50
    });
  });

  it('keeps log response payloads redacted and strict', () => {
    const payload = AdminRequestLogListResponseSchema.parse({
      items: [
        {
          id: 'log_1',
          keyId: 'key_prod',
          requestedModel: 'gpt-main',
          model: 'gpt-main',
          provider: 'openai',
          providerModel: 'gpt-4.1',
          status: 'error',
          promptTokens: 10,
          completionTokens: 0,
          totalTokens: 10,
          estimatedCost: 0.00001,
          latencyMs: 1200,
          stream: false,
          fallbackAttemptCount: 1,
          errorCode: 'provider_error',
          errorMessage: '[redacted]',
          createdAt: '2026-04-25T00:00:00.000Z'
        }
      ],
      nextCursor: null
    });

    expect(JSON.stringify(payload)).not.toContain('sk-provider-secret');
    expect(() =>
      AdminRequestLogListResponseSchema.parse({
        ...payload,
        items: [{ ...payload.items[0], providerSecret: 'sk-provider-secret' }]
      })
    ).toThrow();
  });

  it('parses dashboard rollups for requests, cost, failures, and top dimensions', () => {
    const payload = AdminDashboardResponseSchema.parse({
      summary: {
        requestCount: 2,
        totalTokens: 100,
        estimatedCost: 0.002,
        failureRate: 0.5,
        averageLatencyMs: 300
      },
      topModels: [{ model: 'gpt-main', requestCount: 2, totalTokens: 100, estimatedCost: 0.002 }],
      topKeys: [{ keyId: 'key_prod', requestCount: 2, totalTokens: 100, estimatedCost: 0.002 }],
      topProviders: [{ provider: 'openai', requestCount: 2, totalTokens: 100, estimatedCost: 0.002 }]
    });

    expect(payload.topModels[0].model).toBe('gpt-main');
    expect(payload.summary.failureRate).toBe(0.5);
  });
});
