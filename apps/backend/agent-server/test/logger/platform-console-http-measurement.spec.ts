import { describe, expect, it } from 'vitest';

import {
  measurePlatformConsoleEndpoint,
  measurePlatformConsoleEndpointVariants,
  formatPlatformConsoleHttpMeasurementReport,
  comparePlatformConsoleHttpMeasurementReports,
  formatPlatformConsoleHttpMeasurementComparison,
  formatPlatformConsoleEndpointVariantMeasurement
} from '../../src/logger/platform-console-http-measurement';

function createMockResponse(
  options: {
    status?: number;
    ok?: boolean;
    body?: unknown;
    headers?: Record<string, string>;
    serverTotalMs?: number;
    cacheStatus?: string;
  } = {}
) {
  const body = options.body ?? {
    diagnostics: {
      cacheStatus: options.cacheStatus ?? 'hit',
      timingsMs: { total: options.serverTotalMs ?? 50 }
    }
  };
  return {
    status: options.status ?? 200,
    ok: options.ok ?? true,
    headers: new Headers(options.headers ?? {}),
    json: async () => body,
    text: async () => JSON.stringify(body)
  } as unknown as Response;
}

function createMockFetcher(responses: Array<ReturnType<typeof createMockResponse>>) {
  let callIndex = 0;
  return async (_url: string) => {
    return responses[Math.min(callIndex++, responses.length - 1)];
  };
}

describe('measurePlatformConsoleEndpoint', () => {
  it('measures endpoint with default options', async () => {
    const responses = Array.from({ length: 6 }, () => createMockResponse());
    const fetcher = createMockFetcher(responses);
    let time = 0;
    const now = () => (time += 100);

    const result = await measurePlatformConsoleEndpoint({
      url: 'https://example.com/api',
      fetcher: fetcher as any,
      now
    });

    expect(result.url).toBe('https://example.com/api');
    expect(result.sampleCount).toBe(5);
    expect(result.warmupCount).toBe(1);
    expect(result.requestDurationMs).toBeDefined();
    expect(result.serverTotalDurationMs).toBeDefined();
    expect(result.cacheStatusCounts).toBeDefined();
  });

  it('handles custom iterations and warmup', async () => {
    const responses = Array.from({ length: 5 }, () => createMockResponse());
    const fetcher = createMockFetcher(responses);
    let time = 0;
    const now = () => (time += 100);

    const result = await measurePlatformConsoleEndpoint({
      url: 'https://example.com/api',
      iterations: 3,
      warmup: 2,
      fetcher: fetcher as any,
      now
    });

    expect(result.sampleCount).toBe(3);
    expect(result.warmupCount).toBe(2);
  });

  it('handles custom budgets', async () => {
    const responses = Array.from({ length: 6 }, () => createMockResponse());
    const fetcher = createMockFetcher(responses);
    let time = 0;
    const now = () => (time += 100);

    const result = await measurePlatformConsoleEndpoint({
      url: 'https://example.com/api',
      budgetsMs: { requestP95: 50, serverTotalP95: 50 },
      fetcher: fetcher as any,
      now
    });

    expect(result.budgetsMs.requestP95).toBe(50);
    expect(result.failedBudgets.length).toBeGreaterThan(0);
  });

  it('reports failed request p95 budget', async () => {
    const responses = Array.from({ length: 6 }, () => createMockResponse());
    const fetcher = createMockFetcher(responses);
    let time = 0;
    // Each request takes 100ms, budget is 50ms
    const now = () => (time += 100);

    const result = await measurePlatformConsoleEndpoint({
      url: 'https://example.com/api',
      budgetsMs: { requestP95: 50 },
      fetcher: fetcher as any,
      now
    });

    expect(result.failedBudgets.some(b => b.includes('request p95'))).toBe(true);
  });

  it('reports failed server total p95 budget', async () => {
    const responses = Array.from({ length: 6 }, () => createMockResponse({ serverTotalMs: 2000 }));
    const fetcher = createMockFetcher(responses);
    let time = 0;
    const now = () => (time += 100);

    const result = await measurePlatformConsoleEndpoint({
      url: 'https://example.com/api',
      budgetsMs: { serverTotalP95: 100 },
      fetcher: fetcher as any,
      now
    });

    expect(result.failedBudgets.some(b => b.includes('server total p95'))).toBe(true);
  });

  it('handles missing server total duration', async () => {
    const responses = Array.from({ length: 6 }, () => createMockResponse({ body: {} }));
    const fetcher = createMockFetcher(responses);
    let time = 0;
    const now = () => (time += 100);

    const result = await measurePlatformConsoleEndpoint({
      url: 'https://example.com/api',
      fetcher: fetcher as any,
      now
    });

    expect(result.serverTotalDurationMs).toBeNull();
  });

  it('handles missing cache status', async () => {
    const responses = Array.from({ length: 6 }, () => createMockResponse({ body: { diagnostics: {} } }));
    const fetcher = createMockFetcher(responses);
    let time = 0;
    const now = () => (time += 100);

    const result = await measurePlatformConsoleEndpoint({
      url: 'https://example.com/api',
      fetcher: fetcher as any,
      now
    });

    expect(result.cacheStatusCounts).toEqual({});
  });

  it('throws on failed response', async () => {
    const fetcher = async () => createMockResponse({ ok: false, status: 500 });
    let time = 0;
    const now = () => (time += 100);

    await expect(
      measurePlatformConsoleEndpoint({
        url: 'https://example.com/api',
        iterations: 1,
        warmup: 0,
        fetcher: fetcher as any,
        now
      })
    ).rejects.toThrow('Platform console request failed');
  });
});

describe('measurePlatformConsoleEndpointVariants', () => {
  it('measures baseline and current variants', async () => {
    const responses = Array.from({ length: 12 }, () => createMockResponse());
    const fetcher = createMockFetcher(responses);
    let time = 0;
    const now = () => (time += 100);

    const result = await measurePlatformConsoleEndpointVariants({
      url: 'https://example.com/api',
      baselineLabel: 'baseline',
      baselineUrl: 'https://baseline.example.com',
      currentLabel: 'current',
      currentUrl: 'https://current.example.com',
      iterations: 3,
      warmup: 0,
      fetcher: fetcher as any,
      now
    });

    expect(result.baseline.label).toBe('baseline');
    expect(result.current.label).toBe('current');
    expect(result.comparison).toBeDefined();
    expect(result.comparison.status).toBeDefined();
  });
});

describe('formatPlatformConsoleHttpMeasurementReport', () => {
  it('formats report with server total', () => {
    const report = {
      url: 'https://example.com',
      sampleCount: 5,
      warmupCount: 1,
      requestDurationMs: { min: 50, max: 200, avg: 100, p50: 90, p95: 180 },
      serverTotalDurationMs: { min: 30, max: 150, avg: 70, p50: 60, p95: 130 },
      cacheStatusCounts: { hit: 3, miss: 2 },
      budgetsMs: { requestP95: 1000, serverTotalP95: 1000 },
      failedBudgets: [],
      samples: []
    };

    const result = formatPlatformConsoleHttpMeasurementReport(report);
    expect(result).toContain('Platform console HTTP benchmark');
    expect(result).toContain('https://example.com');
    expect(result).toContain('samples: 5');
    expect(result).toContain('passed');
    expect(result).toContain('server total:');
    expect(result).toContain('hit=3');
    expect(result).toContain('miss=2');
  });

  it('formats report without server total', () => {
    const report = {
      url: 'https://example.com',
      sampleCount: 5,
      warmupCount: 1,
      requestDurationMs: { min: 50, max: 200, avg: 100, p50: 90, p95: 180 },
      serverTotalDurationMs: null,
      cacheStatusCounts: {},
      budgetsMs: { requestP95: 1000, serverTotalP95: 1000 },
      failedBudgets: [],
      samples: []
    };

    const result = formatPlatformConsoleHttpMeasurementReport(report);
    expect(result).toContain('server total: unavailable');
    expect(result).toContain('cache statuses: none');
  });

  it('formats report with failed budgets', () => {
    const report = {
      url: 'https://example.com',
      sampleCount: 5,
      warmupCount: 1,
      requestDurationMs: { min: 50, max: 200, avg: 100, p50: 90, p95: 180 },
      serverTotalDurationMs: null,
      cacheStatusCounts: {},
      budgetsMs: { requestP95: 100, serverTotalP95: 1000 },
      failedBudgets: ['request p95 180ms exceeds 100ms budget'],
      samples: []
    };

    const result = formatPlatformConsoleHttpMeasurementReport(report);
    expect(result).toContain('failed');
    expect(result).toContain('- request p95 180ms exceeds 100ms budget');
  });
});

describe('comparePlatformConsoleHttpMeasurementReports', () => {
  const makeReport = (
    overrides: Partial<{
      requestP95: number;
      serverP95: number | null;
      cacheHitCount: number;
      cacheTotalCount: number;
    }> = {}
  ) => ({
    url: 'https://example.com',
    sampleCount: 5,
    warmupCount: 1,
    requestDurationMs: { min: 50, max: 200, avg: 100, p50: 90, p95: overrides.requestP95 ?? 100 },
    serverTotalDurationMs:
      overrides.serverP95 !== null && overrides.serverP95 !== undefined
        ? { min: 30, max: 150, avg: 70, p50: 60, p95: overrides.serverP95 }
        : null,
    cacheStatusCounts: overrides.cacheTotalCount
      ? { hit: overrides.cacheHitCount ?? 0, miss: overrides.cacheTotalCount - (overrides.cacheHitCount ?? 0) }
      : {},
    budgetsMs: { requestP95: 1000, serverTotalP95: 1000 },
    failedBudgets: [],
    samples: []
  });

  it('reports unchanged when identical', () => {
    const baseline = makeReport();
    const current = makeReport();
    const result = comparePlatformConsoleHttpMeasurementReports(baseline as any, current as any);
    expect(result.status).toBe('unchanged');
    expect(result.requestP95DeltaMs).toBe(0);
    expect(result.highlights).toEqual([]);
  });

  it('reports regressed when request p95 increases', () => {
    const baseline = makeReport({ requestP95: 100 });
    const current = makeReport({ requestP95: 200 });
    const result = comparePlatformConsoleHttpMeasurementReports(baseline as any, current as any);
    expect(result.status).toBe('regressed');
    expect(result.requestP95DeltaMs).toBeGreaterThan(0);
    expect(result.highlights.some(h => h.includes('regressed'))).toBe(true);
  });

  it('reports improved when request p95 decreases', () => {
    const baseline = makeReport({ requestP95: 200 });
    const current = makeReport({ requestP95: 100 });
    const result = comparePlatformConsoleHttpMeasurementReports(baseline as any, current as any);
    expect(result.status).toBe('improved');
    expect(result.requestP95DeltaMs).toBeLessThan(0);
    expect(result.highlights.some(h => h.includes('improved'))).toBe(true);
  });

  it('reports regressed when server total p95 increases', () => {
    const baseline = makeReport({ serverP95: 100 });
    const current = makeReport({ serverP95: 200 });
    const result = comparePlatformConsoleHttpMeasurementReports(baseline as any, current as any);
    expect(result.status).toBe('regressed');
  });

  it('reports improved when server total p95 decreases', () => {
    const baseline = makeReport({ serverP95: 200 });
    const current = makeReport({ serverP95: 100 });
    const result = comparePlatformConsoleHttpMeasurementReports(baseline as any, current as any);
    expect(result.status).toBe('improved');
  });

  it('handles null server total on baseline', () => {
    const baseline = makeReport({ serverP95: null });
    const current = makeReport({ serverP95: 100 });
    const result = comparePlatformConsoleHttpMeasurementReports(baseline as any, current as any);
    expect(result.serverTotalP95DeltaMs).toBeNull();
  });

  it('handles null server total on current', () => {
    const baseline = makeReport({ serverP95: 100 });
    const current = makeReport({ serverP95: null });
    const result = comparePlatformConsoleHttpMeasurementReports(baseline as any, current as any);
    expect(result.serverTotalP95DeltaMs).toBeNull();
  });

  it('reports cache hit rate drop', () => {
    const baseline = makeReport({ cacheHitCount: 8, cacheTotalCount: 10 });
    const current = makeReport({ cacheHitCount: 2, cacheTotalCount: 10 });
    const result = comparePlatformConsoleHttpMeasurementReports(baseline as any, current as any);
    expect(result.cacheHitRateDelta).toBeLessThan(0);
    expect(result.highlights.some(h => h.includes('dropped'))).toBe(true);
  });

  it('reports cache hit rate improvement', () => {
    const baseline = makeReport({ cacheHitCount: 2, cacheTotalCount: 10 });
    const current = makeReport({ cacheHitCount: 8, cacheTotalCount: 10 });
    const result = comparePlatformConsoleHttpMeasurementReports(baseline as any, current as any);
    expect(result.cacheHitRateDelta).toBeGreaterThan(0);
    expect(result.highlights.some(h => h.includes('improved'))).toBe(true);
  });

  it('handles no cache data', () => {
    const baseline = makeReport();
    const current = makeReport();
    const result = comparePlatformConsoleHttpMeasurementReports(baseline as any, current as any);
    expect(result.cacheHitRateDelta).toBeNull();
  });

  it('classifies as unchanged when no deltas', () => {
    const baseline = makeReport({ cacheHitCount: 5, cacheTotalCount: 10 });
    const current = makeReport({ cacheHitCount: 5, cacheTotalCount: 10 });
    const result = comparePlatformConsoleHttpMeasurementReports(baseline as any, current as any);
    expect(result.status).toBe('unchanged');
  });

  it('classifies as improved when cache hit rate increases with no p95 change', () => {
    const baseline = makeReport({ cacheHitCount: 3, cacheTotalCount: 10 });
    const current = makeReport({ cacheHitCount: 7, cacheTotalCount: 10 });
    const result = comparePlatformConsoleHttpMeasurementReports(baseline as any, current as any);
    expect(result.status).toBe('improved');
  });

  it('classifies as regressed when cache hit rate decreases with no p95 change', () => {
    const baseline = makeReport({ cacheHitCount: 7, cacheTotalCount: 10 });
    const current = makeReport({ cacheHitCount: 3, cacheTotalCount: 10 });
    const result = comparePlatformConsoleHttpMeasurementReports(baseline as any, current as any);
    expect(result.status).toBe('regressed');
  });
});

describe('formatPlatformConsoleHttpMeasurementComparison', () => {
  it('formats comparison with highlights', () => {
    const comparison = {
      status: 'regressed' as const,
      requestP95DeltaMs: 50,
      serverTotalP95DeltaMs: 30,
      cacheHitRateDelta: -0.1,
      highlights: ['request p95 regressed by 50ms'],
      baseline: {
        url: 'https://example.com',
        sampleCount: 5,
        warmupCount: 1,
        requestDurationMs: { min: 50, max: 200, avg: 100, p50: 90, p95: 100 },
        serverTotalDurationMs: { min: 30, max: 150, avg: 70, p50: 60, p95: 80 },
        cacheStatusCounts: { hit: 8, miss: 2 },
        budgetsMs: { requestP95: 1000, serverTotalP95: 1000 },
        failedBudgets: [],
        samples: []
      },
      current: {
        url: 'https://example.com',
        sampleCount: 5,
        warmupCount: 1,
        requestDurationMs: { min: 50, max: 200, avg: 100, p50: 90, p95: 150 },
        serverTotalDurationMs: { min: 30, max: 150, avg: 70, p50: 60, p95: 110 },
        cacheStatusCounts: { hit: 5, miss: 5 },
        budgetsMs: { requestP95: 1000, serverTotalP95: 1000 },
        failedBudgets: [],
        samples: []
      }
    };

    const result = formatPlatformConsoleHttpMeasurementComparison(comparison);
    expect(result).toContain('Platform console benchmark comparison');
    expect(result).toContain('regressed');
    expect(result).toContain('- request p95 regressed by 50ms');
  });

  it('formats comparison without highlights', () => {
    const comparison = {
      status: 'unchanged' as const,
      requestP95DeltaMs: 0,
      serverTotalP95DeltaMs: null,
      cacheHitRateDelta: null,
      highlights: [],
      baseline: {
        url: 'https://example.com',
        sampleCount: 5,
        warmupCount: 1,
        requestDurationMs: { min: 50, max: 200, avg: 100, p50: 90, p95: 100 },
        serverTotalDurationMs: null,
        cacheStatusCounts: {},
        budgetsMs: { requestP95: 1000, serverTotalP95: 1000 },
        failedBudgets: [],
        samples: []
      },
      current: {
        url: 'https://example.com',
        sampleCount: 5,
        warmupCount: 1,
        requestDurationMs: { min: 50, max: 200, avg: 100, p50: 90, p95: 100 },
        serverTotalDurationMs: null,
        cacheStatusCounts: {},
        budgetsMs: { requestP95: 1000, serverTotalP95: 1000 },
        failedBudgets: [],
        samples: []
      }
    };

    const result = formatPlatformConsoleHttpMeasurementComparison(comparison);
    expect(result).toContain('unchanged');
  });
});

describe('formatPlatformConsoleEndpointVariantMeasurement', () => {
  it('formats variant measurement', () => {
    const measurement = {
      baseline: {
        label: 'v1',
        report: {
          url: 'https://v1.example.com',
          sampleCount: 5,
          warmupCount: 1,
          requestDurationMs: { min: 50, max: 200, avg: 100, p50: 90, p95: 100 },
          serverTotalDurationMs: null,
          cacheStatusCounts: {},
          budgetsMs: { requestP95: 1000, serverTotalP95: 1000 },
          failedBudgets: [],
          samples: []
        }
      },
      current: {
        label: 'v2',
        report: {
          url: 'https://v2.example.com',
          sampleCount: 5,
          warmupCount: 1,
          requestDurationMs: { min: 50, max: 200, avg: 100, p50: 90, p95: 100 },
          serverTotalDurationMs: null,
          cacheStatusCounts: {},
          budgetsMs: { requestP95: 1000, serverTotalP95: 1000 },
          failedBudgets: [],
          samples: []
        }
      },
      comparison: {
        status: 'unchanged' as const,
        requestP95DeltaMs: 0,
        serverTotalP95DeltaMs: null,
        cacheHitRateDelta: null,
        highlights: [],
        baseline: {
          url: 'https://v1.example.com',
          sampleCount: 5,
          warmupCount: 1,
          requestDurationMs: { min: 50, max: 200, avg: 100, p50: 90, p95: 100 },
          serverTotalDurationMs: null,
          cacheStatusCounts: {},
          budgetsMs: { requestP95: 1000, serverTotalP95: 1000 },
          failedBudgets: [],
          samples: []
        } as any,
        current: {
          url: 'https://v2.example.com',
          sampleCount: 5,
          warmupCount: 1,
          requestDurationMs: { min: 50, max: 200, avg: 100, p50: 90, p95: 100 },
          serverTotalDurationMs: null,
          cacheStatusCounts: {},
          budgetsMs: { requestP95: 1000, serverTotalP95: 1000 },
          failedBudgets: [],
          samples: []
        } as any
      }
    };

    const result = formatPlatformConsoleEndpointVariantMeasurement(measurement as any);
    expect(result).toContain('Platform console variant benchmark');
    expect(result).toContain('v1');
    expect(result).toContain('v2');
  });
});
