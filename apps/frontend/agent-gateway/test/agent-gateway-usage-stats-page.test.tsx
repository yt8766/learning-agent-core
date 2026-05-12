import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { GatewayUsageAnalyticsResponse } from '@agent/core';
import { UsageStatsPage } from '../src/app/pages/UsageStatsPage';

describe('UsageStatsPage', () => {
  it('renders overview cards, trend and request log tables from analytics API data', () => {
    const html = renderToStaticMarkup(<UsageStatsPage analytics={analytics} onRefresh={() => undefined} />);

    expect(html).toContain('使用统计');
    expect(html).toContain('总请求数');
    expect(html).toContain('2,107');
    expect(html).toContain('总 Token 数');
    expect(html).toContain('198,735,821');
    expect(html).toContain('请求日志');
    expect(html).toContain('Provider 统计');
    expect(html).toContain('模型统计');
    expect(html).toContain('Codex (Session)');
    expect(html).toContain('gpt-5.5');
  });
});

const analytics: GatewayUsageAnalyticsResponse = {
  observedAt: '2026-05-11T18:50:00.000Z',
  range: {
    preset: 'today',
    from: '2026-05-11T00:00:00.000Z',
    to: '2026-05-11T18:50:00.000Z',
    bucketMinutes: 60
  },
  activeTab: 'requestLogs',
  summary: {
    requestCount: 2107,
    estimatedCostUsd: 0,
    totalTokens: 198_735_821,
    inputTokens: 197_996_400,
    outputTokens: 739_421,
    cacheCreateTokens: 0,
    cacheHitTokens: 209_544_000
  },
  trend: [
    {
      bucketStart: '2026-05-11T16:00:00.000Z',
      requestCount: 800,
      estimatedCostUsd: 0,
      totalTokens: 48_000_000,
      inputTokens: 47_900_000,
      outputTokens: 100_000,
      cacheCreateTokens: 0,
      cacheHitTokens: 46_000_000
    },
    {
      bucketStart: '2026-05-11T17:00:00.000Z',
      requestCount: 200,
      estimatedCostUsd: 0,
      totalTokens: 9_000_000,
      inputTokens: 8_900_000,
      outputTokens: 100_000,
      cacheCreateTokens: 0,
      cacheHitTokens: 8_000_000
    }
  ],
  requestLogs: {
    items: [
      {
        id: 'req-1',
        occurredAt: '2026-05-11T18:49:00.000Z',
        providerId: 'codex_session',
        providerName: 'Codex (Session)',
        model: 'gpt-5.5',
        inputTokens: 184_407,
        outputTokens: 609,
        totalTokens: 185_016,
        cacheCreateTokens: 0,
        cacheHitTokens: 173_952,
        estimatedCostUsd: 0,
        latencyMs: 0,
        statusCode: 200,
        source: 'codex_session',
        applicationId: 'client-codex'
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
      totalTokens: 198_211_557,
      inputTokens: 197_500_000,
      outputTokens: 711_557,
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
      totalTokens: 198_211_557,
      inputTokens: 197_500_000,
      outputTokens: 711_557,
      estimatedCostUsd: 0,
      averageCostUsd: 0
    }
  ],
  filters: {
    providers: [{ id: 'codex_session', label: 'Codex (Session)', count: 1785 }],
    models: [{ id: 'gpt-5.5', label: 'gpt-5.5', count: 1785 }],
    applications: [{ id: 'client-codex', label: 'Codex Session', count: 1785 }]
  }
};
