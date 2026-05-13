import { describe, expect, it } from 'vitest';

import {
  parsePlatformConsoleLogLine,
  analyzePlatformConsoleLogs,
  formatPlatformConsoleLogAnalysis
} from '../../src/logger/platform-console-log-analysis';

function makeLogLine(overrides: Record<string, unknown> = {}) {
  const record = {
    time: '2026-05-11T12:00:00.000Z',
    context: 'test-context',
    message: JSON.stringify({
      event: 'runtime.platform_console.fresh_aggregate',
      totalDurationMs: 100,
      timingsMs: { db: 50, cache: 20 },
      ...overrides
    })
  };
  return JSON.stringify(record);
}

describe('parsePlatformConsoleLogLine', () => {
  it('returns null for empty line', () => {
    expect(parsePlatformConsoleLogLine('')).toBeNull();
  });

  it('returns null for whitespace-only line', () => {
    expect(parsePlatformConsoleLogLine('   ')).toBeNull();
  });

  it('returns null for invalid JSON', () => {
    expect(parsePlatformConsoleLogLine('not json')).toBeNull();
  });

  it('returns null for JSON without message field', () => {
    expect(parsePlatformConsoleLogLine(JSON.stringify({ time: '2026-05-11' }))).toBeNull();
  });

  it('returns null for non-string message', () => {
    expect(parsePlatformConsoleLogLine(JSON.stringify({ message: 123 }))).toBeNull();
  });

  it('returns null for non-JSON message', () => {
    expect(parsePlatformConsoleLogLine(JSON.stringify({ message: 'not json' }))).toBeNull();
  });

  it('returns null for non-object parsed message', () => {
    expect(parsePlatformConsoleLogLine(JSON.stringify({ message: '"just a string"' }))).toBeNull();
  });

  it('returns null for non-platform-console event', () => {
    expect(
      parsePlatformConsoleLogLine(
        JSON.stringify({
          message: JSON.stringify({ event: 'other_event', totalDurationMs: 100 })
        })
      )
    ).toBeNull();
  });

  it('returns null when totalDurationMs is missing', () => {
    expect(
      parsePlatformConsoleLogLine(
        JSON.stringify({
          message: JSON.stringify({ event: 'runtime.platform_console.fresh_aggregate' })
        })
      )
    ).toBeNull();
  });

  it('returns null when totalDurationMs is not finite', () => {
    expect(
      parsePlatformConsoleLogLine(
        JSON.stringify({
          message: JSON.stringify({ event: 'runtime.platform_console.fresh_aggregate', totalDurationMs: NaN })
        })
      )
    ).toBeNull();
  });

  it('parses a valid fresh_aggregate line', () => {
    const result = parsePlatformConsoleLogLine(makeLogLine());
    expect(result).toBeDefined();
    expect(result!.event).toBe('runtime.platform_console.fresh_aggregate');
    expect(result!.totalDurationMs).toBe(100);
    expect(result!.timingsMs).toEqual({ db: 50, cache: 20 });
    expect(result!.timestamp).toBe('2026-05-11T12:00:00.000Z');
    expect(result!.context).toBe('test-context');
  });

  it('parses a valid slow event line', () => {
    const result = parsePlatformConsoleLogLine(
      makeLogLine({
        event: 'runtime.platform_console.slow',
        thresholdMs: 1200
      })
    );
    expect(result!.event).toBe('runtime.platform_console.slow');
    expect(result!.thresholdMs).toBe(1200);
  });

  it('handles missing context', () => {
    const line = JSON.stringify({
      time: '2026-05-11T12:00:00.000Z',
      message: JSON.stringify({
        event: 'runtime.platform_console.fresh_aggregate',
        totalDurationMs: 100,
        timingsMs: {}
      })
    });
    const result = parsePlatformConsoleLogLine(line);
    expect(result!.context).toBeUndefined();
  });

  it('handles optional numeric fields', () => {
    const result = parsePlatformConsoleLogLine(
      makeLogLine({
        days: 7,
        taskCount: 42,
        sessionCount: 10
      })
    );
    expect(result!.days).toBe(7);
    expect(result!.taskCount).toBe(42);
    expect(result!.sessionCount).toBe(10);
  });

  it('ignores non-number optional fields', () => {
    const result = parsePlatformConsoleLogLine(
      makeLogLine({
        days: 'not-a-number',
        taskCount: null
      })
    );
    expect(result!.days).toBeUndefined();
    expect(result!.taskCount).toBeUndefined();
  });

  it('handles cacheStatus string', () => {
    const result = parsePlatformConsoleLogLine(makeLogLine({ cacheStatus: 'hit' }));
    expect(result!.cacheStatus).toBe('hit');
  });

  it('ignores non-string cacheStatus', () => {
    const result = parsePlatformConsoleLogLine(makeLogLine({ cacheStatus: 123 }));
    expect(result!.cacheStatus).toBeUndefined();
  });

  it('handles filters object', () => {
    const result = parsePlatformConsoleLogLine(
      makeLogLine({
        filters: { model: 'gpt-4', status: 'success' }
      })
    );
    expect(result!.filters).toEqual({ model: 'gpt-4', status: 'success' });
  });

  it('ignores non-object filters', () => {
    const result = parsePlatformConsoleLogLine(makeLogLine({ filters: 'not-object' }));
    expect(result!.filters).toBeUndefined();
  });

  it('ignores array filters', () => {
    const result = parsePlatformConsoleLogLine(makeLogLine({ filters: [1, 2, 3] }));
    expect(result!.filters).toBeUndefined();
  });

  it('normalizes timingsMs - filters non-number values', () => {
    const result = parsePlatformConsoleLogLine(
      makeLogLine({
        timingsMs: { db: 50, cache: 'not-number', invalid: NaN, valid: 30 }
      })
    );
    expect(result!.timingsMs).toEqual({ db: 50, valid: 30 });
  });

  it('handles non-object timingsMs', () => {
    const result = parsePlatformConsoleLogLine(makeLogLine({ timingsMs: 'not-object' }));
    expect(result!.timingsMs).toEqual({});
  });

  it('handles missing time field', () => {
    const line = JSON.stringify({
      message: JSON.stringify({
        event: 'runtime.platform_console.fresh_aggregate',
        totalDurationMs: 100,
        timingsMs: {}
      })
    });
    const result = parsePlatformConsoleLogLine(line);
    expect(result!.timestamp).toBe('');
  });
});

describe('analyzePlatformConsoleLogs', () => {
  it('returns empty analysis for no lines', () => {
    const result = analyzePlatformConsoleLogs([]);
    expect(result.sampleCount).toBe(0);
    expect(result.summary.status).toBe('healthy');
    expect(result.latestSamples).toEqual([]);
  });

  it('parses and groups samples by event', () => {
    const lines = [
      makeLogLine({ totalDurationMs: 100 }),
      makeLogLine({ totalDurationMs: 200, event: 'runtime.platform_console.slow', thresholdMs: 1200 })
    ];
    const result = analyzePlatformConsoleLogs(lines);
    expect(result.sampleCount).toBe(2);
    expect(result.byEvent['runtime.platform_console.fresh_aggregate']).toBeDefined();
    expect(result.byEvent['runtime.platform_console.slow']).toBeDefined();
  });

  it('limits latest samples', () => {
    const lines = Array.from({ length: 10 }, (_, i) => makeLogLine({ totalDurationMs: 100 + i }));
    const result = analyzePlatformConsoleLogs(lines, { latestSampleLimit: 3 });
    expect(result.latestSamples).toHaveLength(3);
  });

  it('defaults latestSampleLimit to 5', () => {
    const lines = Array.from({ length: 10 }, () => makeLogLine());
    const result = analyzePlatformConsoleLogs(lines);
    expect(result.latestSamples).toHaveLength(5);
  });

  it('filters out invalid lines', () => {
    const lines = [makeLogLine(), 'invalid json', '', makeLogLine({ totalDurationMs: 300 })];
    const result = analyzePlatformConsoleLogs(lines);
    expect(result.sampleCount).toBe(2);
  });

  it('summarizes timing percentiles', () => {
    const lines = [
      makeLogLine({ timingsMs: { db: 50, cache: 10 } }),
      makeLogLine({ timingsMs: { db: 100, cache: 20 } }),
      makeLogLine({ timingsMs: { db: 150, cache: 30 } })
    ];
    const result = analyzePlatformConsoleLogs(lines);
    const agg = result.byEvent['runtime.platform_console.fresh_aggregate']!;
    expect(agg.timingPercentilesMs.db).toBeDefined();
    expect(agg.timingPercentilesMs.db.p50).toBeDefined();
    expect(agg.timingPercentilesMs.db.p95).toBeDefined();
  });

  it('reports healthy status when within budgets', () => {
    const lines = [makeLogLine({ totalDurationMs: 100 })];
    const result = analyzePlatformConsoleLogs(lines);
    expect(result.summary.status).toBe('healthy');
  });

  it('reports critical status when slow events exist', () => {
    const lines = [makeLogLine({ event: 'runtime.platform_console.slow', totalDurationMs: 2000, thresholdMs: 1200 })];
    const result = analyzePlatformConsoleLogs(lines);
    expect(result.summary.status).toBe('critical');
  });

  it('reports warning when fresh aggregate p95 exceeds budget', () => {
    const lines = Array.from({ length: 10 }, () => makeLogLine({ totalDurationMs: 700 }));
    const result = analyzePlatformConsoleLogs(lines);
    // p95 of 700ms repeated 10 times = 700ms, budget is 600ms
    expect(result.summary.status).toBe('warning');
    expect(result.summary.reasons.some(r => r.includes('fresh p95'))).toBe(true);
  });

  it('includes reason when slow event p95 exceeds budget', () => {
    const lines = [
      makeLogLine({ event: 'runtime.platform_console.slow', totalDurationMs: 1500, thresholdMs: 1200 }),
      makeLogLine({ event: 'runtime.platform_console.slow', totalDurationMs: 1600, thresholdMs: 1200 })
    ];
    const result = analyzePlatformConsoleLogs(lines);
    expect(result.summary.reasons.some(r => r.includes('slow p95'))).toBe(true);
    expect(result.summary.reasons.some(r => r.includes('slow event count'))).toBe(true);
  });

  it('includes fresh budget reason when fresh aggregate has no samples', () => {
    const lines = [makeLogLine({ event: 'runtime.platform_console.slow', totalDurationMs: 500, thresholdMs: 1200 })];
    const result = analyzePlatformConsoleLogs(lines);
    // slow event count > 0 means critical, but fresh has no data
    expect(result.summary.reasons.some(r => r.includes('slow event count'))).toBe(true);
  });

  it('uses healthy reason with fresh aggregate info when present', () => {
    const lines = [makeLogLine({ totalDurationMs: 100 })];
    const result = analyzePlatformConsoleLogs(lines);
    expect(result.summary.reasons[0]).toContain('fresh p95');
    expect(result.summary.reasons[0]).toContain('within');
  });

  it('uses healthy reason without fresh aggregate when absent', () => {
    const result = analyzePlatformConsoleLogs([]);
    expect(result.summary.reasons[0]).toContain('no recent');
  });
});

describe('formatPlatformConsoleLogAnalysis', () => {
  it('formats empty analysis', () => {
    const result = formatPlatformConsoleLogAnalysis({
      sampleCount: 0,
      summary: { status: 'healthy', reasons: [], budgetsMs: { freshAggregateP95: 600, slowP95: 1200 } },
      byEvent: {},
      latestSamples: []
    });
    expect(result).toContain('No platform console events found');
  });

  it('formats analysis with samples', () => {
    const result = formatPlatformConsoleLogAnalysis({
      sampleCount: 2,
      summary: {
        status: 'healthy',
        reasons: ['all good'],
        budgetsMs: { freshAggregateP95: 600, slowP95: 1200 }
      },
      byEvent: {
        'runtime.platform_console.fresh_aggregate': {
          count: 2,
          totalDurationMs: { min: 50, max: 150, avg: 100, p50: 100, p95: 140 },
          timingPercentilesMs: { db: { p50: 50, p95: 80, max: 100 } }
        }
      },
      latestSamples: [
        {
          event: 'runtime.platform_console.fresh_aggregate',
          timestamp: '2026-05-11T12:00:00.000Z',
          totalDurationMs: 100,
          cacheStatus: 'hit',
          taskCount: 5,
          sessionCount: 2,
          timingsMs: {}
        }
      ]
    });
    expect(result).toContain('Platform console log samples: 2');
    expect(result).toContain('healthy');
    expect(result).toContain('runtime.platform_console.fresh_aggregate');
    expect(result).toContain('Latest samples:');
    expect(result).toContain('cache=hit');
    expect(result).toContain('tasks=5');
    expect(result).toContain('sessions=2');
  });

  it('formats analysis with timing percentiles', () => {
    const result = formatPlatformConsoleLogAnalysis({
      sampleCount: 1,
      summary: { status: 'healthy', reasons: ['ok'], budgetsMs: { freshAggregateP95: 600, slowP95: 1200 } },
      byEvent: {
        'runtime.platform_console.fresh_aggregate': {
          count: 1,
          totalDurationMs: { min: 100, max: 100, avg: 100, p50: 100, p95: 100 },
          timingPercentilesMs: { db: { p50: 50, p95: 60, max: 70 }, cache: { p50: 10, p95: 20, max: 30 } }
        }
      },
      latestSamples: []
    });
    expect(result).toContain('db: p50=50ms p95=60ms max=70ms');
    expect(result).toContain('cache: p50=10ms p95=20ms max=30ms');
  });

  it('handles missing cacheStatus and taskCount in latest samples', () => {
    const result = formatPlatformConsoleLogAnalysis({
      sampleCount: 1,
      summary: { status: 'healthy', reasons: ['ok'], budgetsMs: { freshAggregateP95: 600, slowP95: 1200 } },
      byEvent: {},
      latestSamples: [
        {
          event: 'runtime.platform_console.fresh_aggregate',
          timestamp: '2026-05-11T12:00:00.000Z',
          totalDurationMs: 100,
          timingsMs: {}
        }
      ]
    });
    expect(result).toContain('cache=unknown');
    expect(result).toContain('tasks=0');
    expect(result).toContain('sessions=0');
  });
});
