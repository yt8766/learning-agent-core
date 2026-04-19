import { describe, expect, it } from 'vitest';

import {
  comparePlatformConsoleHttpMeasurementReports,
  formatPlatformConsoleEndpointVariantMeasurement,
  formatPlatformConsoleHttpMeasurementReport,
  formatPlatformConsoleHttpMeasurementComparison,
  measurePlatformConsoleEndpoint,
  measurePlatformConsoleEndpointVariants
} from '../../src/logger/platform-console-http-measurement';

describe('platform-console-http-measurement', () => {
  it('measures request latency, server diagnostics, and cache statuses across samples', async () => {
    const responses = [
      {
        ok: true,
        status: 200,
        json: async () => ({
          diagnostics: {
            cacheStatus: 'miss',
            timingsMs: {
              total: 920
            }
          }
        })
      },
      {
        ok: true,
        status: 200,
        json: async () => ({
          diagnostics: {
            cacheStatus: 'hit',
            timingsMs: {
              total: 180
            }
          }
        })
      },
      {
        ok: true,
        status: 200,
        json: async () => ({
          diagnostics: {
            cacheStatus: 'hit',
            timingsMs: {
              total: 210
            }
          }
        })
      }
    ];
    let fetchIndex = 0;
    const timestamps = [0, 40, 40, 920, 920, 1040];
    let nowIndex = 0;

    const report = await measurePlatformConsoleEndpoint({
      url: 'http://127.0.0.1:3000/api/platform/console?days=30',
      iterations: 2,
      warmup: 1,
      fetcher: async () => responses[fetchIndex++] as Response,
      now: () => timestamps[nowIndex++] ?? timestamps[timestamps.length - 1]!
    });

    expect(report.sampleCount).toBe(2);
    expect(report.warmupCount).toBe(1);
    expect(report.requestDurationMs).toEqual({
      min: 120,
      max: 880,
      avg: 500,
      p50: 120,
      p95: 880
    });
    expect(report.serverTotalDurationMs).toEqual({
      min: 180,
      max: 210,
      avg: 195,
      p50: 180,
      p95: 210
    });
    expect(report.cacheStatusCounts).toEqual({
      hit: 2
    });
    expect(report.failedBudgets).toEqual([]);
  });

  it('flags budget regressions and prints a readable summary', async () => {
    const report = await measurePlatformConsoleEndpoint({
      url: 'http://127.0.0.1:3000/api/platform/console?days=30',
      iterations: 2,
      fetcher: async () =>
        ({
          ok: true,
          status: 200,
          json: async () => ({
            diagnostics: {
              cacheStatus: 'miss',
              timingsMs: {
                total: 1600
              }
            }
          })
        }) as Response,
      now: (() => {
        const durations = [0, 1300, 1300, 2500];
        let index = 0;
        return () => durations[index++] ?? 2500;
      })()
    });

    expect(report.failedBudgets).toEqual([
      'request p95 1200ms exceeds 1000ms budget',
      'server total p95 1600ms exceeds 1000ms budget'
    ]);

    const output = formatPlatformConsoleHttpMeasurementReport(report);
    expect(output).toContain('Platform console HTTP benchmark');
    expect(output).toContain('Budget status: failed');
    expect(output).toContain('request p95 1200ms exceeds 1000ms budget');
    expect(output).toContain('cache statuses: miss=2');
  });

  it('compares current and baseline reports and highlights regressions or improvements', () => {
    const comparison = comparePlatformConsoleHttpMeasurementReports(
      {
        url: 'http://127.0.0.1:3000/api/platform/console?days=30',
        sampleCount: 5,
        warmupCount: 1,
        requestDurationMs: { min: 180, max: 920, avg: 460, p50: 420, p95: 900 },
        serverTotalDurationMs: { min: 140, max: 760, avg: 350, p50: 300, p95: 720 },
        cacheStatusCounts: { hit: 4, miss: 1 },
        budgetsMs: { requestP95: 1000, serverTotalP95: 1000 },
        failedBudgets: [],
        samples: []
      },
      {
        url: 'http://127.0.0.1:3000/api/platform/console?days=30',
        sampleCount: 5,
        warmupCount: 1,
        requestDurationMs: { min: 220, max: 1320, avg: 610, p50: 550, p95: 1280 },
        serverTotalDurationMs: { min: 190, max: 980, avg: 470, p50: 430, p95: 940 },
        cacheStatusCounts: { hit: 2, miss: 3 },
        budgetsMs: { requestP95: 1000, serverTotalP95: 1000 },
        failedBudgets: ['request p95 1280ms exceeds 1000ms budget'],
        samples: []
      }
    );

    expect(comparison.status).toBe('regressed');
    expect(comparison.requestP95DeltaMs).toBe(380);
    expect(comparison.serverTotalP95DeltaMs).toBe(220);
    expect(comparison.cacheHitRateDelta).toBe(-0.4);
    expect(comparison.highlights).toEqual([
      'request p95 regressed by 380ms',
      'server total p95 regressed by 220ms',
      'cache hit rate dropped by 40pp'
    ]);

    const output = formatPlatformConsoleHttpMeasurementComparison(comparison);
    expect(output).toContain('Platform console benchmark comparison');
    expect(output).toContain('Status: regressed');
    expect(output).toContain('request p95: baseline 900ms -> current 1280ms');
    expect(output).toContain('cache hit rate: baseline 80% -> current 40%');
  });

  it('measures console vs shell variants and reports shell improvement clearly', async () => {
    const responses = [
      {
        ok: true,
        status: 200,
        json: async () => ({
          diagnostics: {
            cacheStatus: 'miss',
            timingsMs: { total: 980 }
          }
        })
      },
      {
        ok: true,
        status: 200,
        json: async () => ({
          diagnostics: {
            cacheStatus: 'hit',
            timingsMs: { total: 240 }
          }
        })
      }
    ];
    let fetchIndex = 0;
    const timestamps = [0, 1200, 1200, 1560];
    let nowIndex = 0;

    const report = await measurePlatformConsoleEndpointVariants({
      baselineLabel: 'console',
      baselineUrl: 'http://127.0.0.1:3000/api/platform/console?days=30',
      currentLabel: 'console-shell',
      currentUrl: 'http://127.0.0.1:3000/api/platform/console-shell?days=30',
      iterations: 1,
      warmup: 0,
      fetcher: async () => responses[fetchIndex++] as Response,
      now: () => timestamps[nowIndex++] ?? timestamps[timestamps.length - 1]!
    });

    expect(report.baseline.label).toBe('console');
    expect(report.current.label).toBe('console-shell');
    expect(report.baseline.report.requestDurationMs.p95).toBe(1200);
    expect(report.current.report.requestDurationMs.p95).toBe(360);
    expect(report.comparison.status).toBe('improved');
    expect(report.comparison.requestP95DeltaMs).toBe(-840);

    const output = formatPlatformConsoleEndpointVariantMeasurement(report);
    expect(output).toContain('Platform console variant benchmark');
    expect(output).toContain('baseline: console');
    expect(output).toContain('current: console-shell');
    expect(output).toContain('request p95 improved by 840ms');
  });
});
