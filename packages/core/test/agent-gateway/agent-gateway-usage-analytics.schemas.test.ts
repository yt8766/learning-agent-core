import { describe, expect, it } from 'vitest';
import { GatewayUsageAnalyticsQuerySchema, GatewayUsageAnalyticsResponseSchema } from '../../src';

describe('GatewayUsageAnalytics schemas', () => {
  it('parses the usage statistics aggregate contract', () => {
    const parsed = GatewayUsageAnalyticsResponseSchema.parse({
      observedAt: '2026-05-11T18:49:00.000Z',
      range: {
        preset: 'today',
        from: '2026-05-11T00:00:00.000Z',
        to: '2026-05-11T23:59:59.999Z',
        bucketMinutes: 60
      },
      activeTab: 'requestLogs',
      summary: {
        requestCount: 2107,
        estimatedCostUsd: 0,
        totalTokens: 198735821,
        inputTokens: 197996400,
        outputTokens: 739421,
        cacheCreateTokens: 0,
        cacheHitTokens: 209544000
      },
      trend: [
        {
          bucketStart: '2026-05-11T18:00:00.000Z',
          requestCount: 12,
          estimatedCostUsd: 0,
          totalTokens: 1000,
          inputTokens: 900,
          outputTokens: 100,
          cacheCreateTokens: 0,
          cacheHitTokens: 500
        }
      ],
      requestLogs: {
        items: [
          {
            id: 'log-1',
            occurredAt: '2026-05-11T18:49:00.000Z',
            providerId: 'codex_session',
            providerName: 'Codex (Session)',
            model: 'gpt-5.5',
            inputTokens: 184407,
            outputTokens: 609,
            totalTokens: 185016,
            cacheCreateTokens: 0,
            cacheHitTokens: 173952,
            estimatedCostUsd: 0,
            latencyMs: 0,
            statusCode: 200,
            source: 'codex_session',
            applicationId: null
          }
        ],
        total: 1,
        nextCursor: null
      },
      providerStats: [
        {
          providerId: 'codex_session',
          providerName: 'Codex (Session)',
          requestCount: 1785,
          totalTokens: 198211557,
          inputTokens: 197996400,
          outputTokens: 215157,
          estimatedCostUsd: 0,
          successRate: 1,
          averageLatencyMs: 0
        }
      ],
      modelStats: [
        {
          model: 'gpt-5.5',
          providerId: 'codex_session',
          requestCount: 1785,
          totalTokens: 198211557,
          inputTokens: 197996400,
          outputTokens: 215157,
          estimatedCostUsd: 0,
          averageCostUsd: 0
        }
      ],
      filters: {
        providers: [{ id: 'codex_session', label: 'Codex (Session)', count: 1785 }],
        models: [{ id: 'gpt-5.5', label: 'gpt-5.5', count: 1785 }],
        applications: []
      }
    });

    expect(parsed.summary.requestCount).toBe(2107);
    expect(parsed.providerStats[0]?.successRate).toBe(1);
  });

  it('normalizes query defaults for the usage statistics page', () => {
    expect(GatewayUsageAnalyticsQuerySchema.parse({})).toMatchObject({
      range: 'today',
      status: 'all',
      limit: 100
    });
  });
});
