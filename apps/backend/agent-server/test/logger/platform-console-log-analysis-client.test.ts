import { describe, expect, it } from 'vitest';

import { fetchPlatformConsoleLogAnalysis } from '../../src/logger/platform-console-log-analysis-client';

describe('platform-console-log-analysis-client', () => {
  it('fetches trend analysis from the diagnostics endpoint and returns parsed json', async () => {
    const analysis = await fetchPlatformConsoleLogAnalysis({
      baseUrl: 'https://staging.example.com',
      days: 7,
      fetcher: async (url: string | URL | Request) =>
        ({
          ok: true,
          status: 200,
          json: async () => ({
            sampleCount: 4,
            summary: {
              status: 'healthy',
              reasons: ['fresh p95 420ms within 600ms budget and no slow events detected'],
              budgetsMs: { freshAggregateP95: 600, slowP95: 1200 }
            },
            byEvent: {},
            latestSamples: []
          }),
          url: String(url)
        }) as Response
    });

    expect(analysis).toEqual({
      sampleCount: 4,
      summary: {
        status: 'healthy',
        reasons: ['fresh p95 420ms within 600ms budget and no slow events detected'],
        budgetsMs: { freshAggregateP95: 600, slowP95: 1200 }
      },
      byEvent: {},
      latestSamples: []
    });
  });

  it('throws a readable error when the diagnostics endpoint fails', async () => {
    await expect(
      fetchPlatformConsoleLogAnalysis({
        baseUrl: 'https://staging.example.com',
        days: 7,
        fetcher: async () =>
          ({
            ok: false,
            status: 503,
            text: async () => 'service unavailable'
          }) as Response
      })
    ).rejects.toThrow('Platform console log analysis request failed with 503');
  });
});
