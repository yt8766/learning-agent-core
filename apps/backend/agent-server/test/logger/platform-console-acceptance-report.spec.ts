import { describe, expect, it } from 'vitest';

import { renderPlatformConsoleAcceptanceReport } from '../../src/logger/platform-console-acceptance-report';

function makeReport(overrides: Record<string, any> = {}) {
  return {
    url: 'https://example.com/api',
    sampleCount: 5,
    warmupCount: 1,
    requestDurationMs: { min: 50, max: 200, avg: 100, p50: 90, p95: 180 },
    serverTotalDurationMs: { min: 30, max: 150, avg: 70, p50: 60, p95: 130 },
    cacheStatusCounts: { hit: 3, miss: 2 },
    budgetsMs: { requestP95: 1000, serverTotalP95: 1000 },
    failedBudgets: [],
    samples: [],
    ...overrides
  };
}

function makeMetadata(overrides: Record<string, any> = {}) {
  return {
    date: '2026-05-11',
    reviewer: 'Test Reviewer',
    environment: 'staging',
    version: 'v1.0.0',
    goal: 'Performance validation',
    backendUrl: 'https://staging.example.com',
    ...overrides
  };
}

describe('renderPlatformConsoleAcceptanceReport', () => {
  it('renders basic report without comparison or log analysis', () => {
    const result = renderPlatformConsoleAcceptanceReport({
      metadata: makeMetadata(),
      currentReport: makeReport()
    });
    expect(result).toContain('Platform Console Staging Acceptance');
    expect(result).toContain('2026-05-11');
    expect(result).toContain('Test Reviewer');
    expect(result).toContain('staging');
    expect(result).toContain('v1.0.0');
    expect(result).toContain('Performance validation');
    expect(result).toContain('passed');
    expect(result).toContain('通过');
  });

  it('renders report with comparison', () => {
    const result = renderPlatformConsoleAcceptanceReport({
      metadata: makeMetadata(),
      currentReport: makeReport(),
      comparison: {
        status: 'improved',
        requestP95DeltaMs: -50,
        serverTotalP95DeltaMs: -30,
        cacheHitRateDelta: 0.1,
        highlights: ['request p95 improved by 50ms'],
        baseline: makeReport(),
        current: makeReport()
      }
    });
    expect(result).toContain('improved');
    expect(result).toContain('-50ms');
    expect(result).toContain('request p95 improved by 50ms');
  });

  it('renders report with comparison null serverTotalP95DeltaMs', () => {
    const result = renderPlatformConsoleAcceptanceReport({
      metadata: makeMetadata(),
      currentReport: makeReport(),
      comparison: {
        status: 'unchanged',
        requestP95DeltaMs: 0,
        serverTotalP95DeltaMs: null,
        cacheHitRateDelta: null,
        highlights: [],
        baseline: makeReport(),
        current: makeReport()
      }
    });
    expect(result).toContain('n/a');
    expect(result).toContain('无');
  });

  it('renders report with log analysis', () => {
    const result = renderPlatformConsoleAcceptanceReport({
      metadata: makeMetadata(),
      currentReport: makeReport(),
      logAnalysis: {
        sampleCount: 10,
        summary: {
          status: 'healthy',
          reasons: ['all good'],
          budgetsMs: { freshAggregateP95: 600, slowP95: 1200 }
        },
        byEvent: {
          'runtime.platform_console.fresh_aggregate': {
            count: 10,
            totalDurationMs: { min: 50, max: 200, avg: 100, p50: 90, p95: 180 },
            timingPercentilesMs: {}
          },
          'runtime.platform_console.slow': {
            count: 2,
            totalDurationMs: { min: 100, max: 300, avg: 200, p50: 180, p95: 280 },
            timingPercentilesMs: {}
          }
        },
        latestSamples: []
      }
    });
    expect(result).toContain('趋势检查');
    expect(result).toContain('healthy');
    expect(result).toContain('180ms');
    expect(result).toContain('slow count');
  });

  it('renders report with no log analysis events', () => {
    const result = renderPlatformConsoleAcceptanceReport({
      metadata: makeMetadata(),
      currentReport: makeReport(),
      logAnalysis: {
        sampleCount: 0,
        summary: {
          status: 'healthy',
          reasons: ['no data'],
          budgetsMs: { freshAggregateP95: 600, slowP95: 1200 }
        },
        byEvent: {},
        latestSamples: []
      }
    });
    expect(result).toContain('n/a');
  });

  it('renders failed budgets', () => {
    const result = renderPlatformConsoleAcceptanceReport({
      metadata: makeMetadata(),
      currentReport: makeReport({ failedBudgets: ['request p95 exceeds budget'] })
    });
    expect(result).toContain('failed');
    expect(result).toContain('不通过');
    expect(result).toContain('request p95 exceeds budget');
  });

  it('renders failed when log analysis is not healthy', () => {
    const result = renderPlatformConsoleAcceptanceReport({
      metadata: makeMetadata(),
      currentReport: makeReport(),
      logAnalysis: {
        sampleCount: 5,
        summary: {
          status: 'critical',
          reasons: ['slow events detected'],
          budgetsMs: { freshAggregateP95: 600, slowP95: 1200 }
        },
        byEvent: {},
        latestSamples: []
      }
    });
    expect(result).toContain('不通过');
    expect(result).toContain('critical');
  });

  it('renders passed when log analysis is healthy', () => {
    const result = renderPlatformConsoleAcceptanceReport({
      metadata: makeMetadata(),
      currentReport: makeReport(),
      logAnalysis: {
        sampleCount: 5,
        summary: {
          status: 'healthy',
          reasons: ['all good'],
          budgetsMs: { freshAggregateP95: 600, slowP95: 1200 }
        },
        byEvent: {},
        latestSamples: []
      }
    });
    expect(result).toContain('通过');
  });

  it('renders without baselineJsonPath', () => {
    const result = renderPlatformConsoleAcceptanceReport({
      metadata: makeMetadata({ baselineJsonPath: undefined }),
      currentReport: makeReport()
    });
    expect(result).toContain('否');
    expect(result).toContain('未提供');
  });

  it('renders with baselineJsonPath', () => {
    const result = renderPlatformConsoleAcceptanceReport({
      metadata: makeMetadata({ baselineJsonPath: '/path/to/baseline.json', currentJsonPath: '/path/to/current.json' }),
      currentReport: makeReport()
    });
    expect(result).toContain('是');
    expect(result).toContain('/path/to/baseline.json');
    expect(result).toContain('/path/to/current.json');
  });

  it('renders without serverTotalDurationMs', () => {
    const result = renderPlatformConsoleAcceptanceReport({
      metadata: makeMetadata(),
      currentReport: makeReport({ serverTotalDurationMs: null })
    });
    expect(result).toContain('n/a');
  });

  it('renders empty cacheStatusCounts', () => {
    const result = renderPlatformConsoleAcceptanceReport({
      metadata: makeMetadata(),
      currentReport: makeReport({ cacheStatusCounts: {} })
    });
    expect(result).toContain('none');
  });

  it('renders conclusion summary for failed budget', () => {
    const result = renderPlatformConsoleAcceptanceReport({
      metadata: makeMetadata(),
      currentReport: makeReport({ failedBudgets: ['request p95 2000ms exceeds 1000ms budget'] })
    });
    expect(result).toContain('即时基线仍未通过预算');
    expect(result).toContain('request p95 2000ms exceeds 1000ms budget');
  });

  it('renders conclusion summary for unhealthy log analysis', () => {
    const result = renderPlatformConsoleAcceptanceReport({
      metadata: makeMetadata(),
      currentReport: makeReport(),
      logAnalysis: {
        sampleCount: 5,
        summary: {
          status: 'warning',
          reasons: ['high p95'],
          budgetsMs: { freshAggregateP95: 600, slowP95: 1200 }
        },
        byEvent: {},
        latestSamples: []
      }
    });
    expect(result).toContain('趋势仍为');
    expect(result).toContain('warning');
  });

  it('renders conclusion summary when no log analysis and budget passed', () => {
    const result = renderPlatformConsoleAcceptanceReport({
      metadata: makeMetadata(),
      currentReport: makeReport()
    });
    expect(result).toContain('通过');
  });

  it('renders cache status counts in sorted order', () => {
    const result = renderPlatformConsoleAcceptanceReport({
      metadata: makeMetadata(),
      currentReport: makeReport({ cacheStatusCounts: { miss: 1, hit: 5, stale: 2 } })
    });
    expect(result).toContain('hit=5, miss=1, stale=2');
  });

  it('renders comparison with cache hit rate delta', () => {
    const result = renderPlatformConsoleAcceptanceReport({
      metadata: makeMetadata(),
      currentReport: makeReport(),
      comparison: {
        status: 'regressed',
        requestP95DeltaMs: 50,
        serverTotalP95DeltaMs: 30,
        cacheHitRateDelta: -0.15,
        highlights: ['cache hit rate dropped'],
        baseline: makeReport(),
        current: makeReport()
      }
    });
    expect(result).toContain('50ms');
    expect(result).toContain('30ms');
    expect(result).toContain('-15pp');
  });
});
