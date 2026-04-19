import { describe, expect, it } from 'vitest';

import {
  analyzePlatformConsoleLogs,
  formatPlatformConsoleLogAnalysis,
  parsePlatformConsoleLogLine
} from '../../src/logger/platform-console-log-analysis';

describe('platform-console-log-analysis', () => {
  it('parses structured platform console events from persisted log lines', () => {
    const sample = parsePlatformConsoleLogLine(
      JSON.stringify({
        time: '2026-04-19T01:00:00.000Z',
        context: 'RuntimeCentersQueryService',
        message: JSON.stringify({
          event: 'runtime.platform_console.slow',
          days: 30,
          cacheStatus: 'miss',
          totalDurationMs: 1280,
          thresholdMs: 1000,
          taskCount: 2,
          sessionCount: 1,
          timingsMs: {
            total: 1280,
            runtime: 480,
            evals: 510
          },
          filters: {
            status: 'running'
          }
        })
      })
    );

    expect(sample).toEqual({
      event: 'runtime.platform_console.slow',
      timestamp: '2026-04-19T01:00:00.000Z',
      context: 'RuntimeCentersQueryService',
      days: 30,
      cacheStatus: 'miss',
      totalDurationMs: 1280,
      thresholdMs: 1000,
      taskCount: 2,
      sessionCount: 1,
      timingsMs: {
        total: 1280,
        runtime: 480,
        evals: 510
      },
      filters: {
        status: 'running'
      }
    });
  });

  it('aggregates p50 and p95 metrics by event and lists latest samples', () => {
    const analysis = analyzePlatformConsoleLogs(
      [
        JSON.stringify({
          time: '2026-04-19T01:00:00.000Z',
          message: JSON.stringify({
            event: 'runtime.platform_console.fresh_aggregate',
            totalDurationMs: 320,
            timingsMs: { total: 320, runtime: 120, evals: 130 }
          })
        }),
        JSON.stringify({
          time: '2026-04-19T01:01:00.000Z',
          message: JSON.stringify({
            event: 'runtime.platform_console.fresh_aggregate',
            totalDurationMs: 420,
            timingsMs: { total: 420, runtime: 150, evals: 180 }
          })
        }),
        JSON.stringify({
          time: '2026-04-19T01:02:00.000Z',
          message: JSON.stringify({
            event: 'runtime.platform_console.slow',
            totalDurationMs: 1280,
            timingsMs: { total: 1280, runtime: 480, evals: 510 }
          })
        }),
        JSON.stringify({
          time: '2026-04-19T01:03:00.000Z',
          message: 'not-json'
        })
      ],
      { latestSampleLimit: 2 }
    );

    expect(analysis.sampleCount).toBe(3);
    expect(analysis.byEvent['runtime.platform_console.fresh_aggregate']).toEqual({
      count: 2,
      totalDurationMs: {
        min: 320,
        max: 420,
        avg: 370,
        p50: 320,
        p95: 420
      },
      timingPercentilesMs: {
        evals: { p50: 130, p95: 180, max: 180 },
        runtime: { p50: 120, p95: 150, max: 150 },
        total: { p50: 320, p95: 420, max: 420 }
      }
    });
    expect(analysis.byEvent['runtime.platform_console.slow']).toEqual({
      count: 1,
      totalDurationMs: {
        min: 1280,
        max: 1280,
        avg: 1280,
        p50: 1280,
        p95: 1280
      },
      timingPercentilesMs: {
        evals: { p50: 510, p95: 510, max: 510 },
        runtime: { p50: 480, p95: 480, max: 480 },
        total: { p50: 1280, p95: 1280, max: 1280 }
      }
    });
    expect(analysis.summary).toEqual({
      status: 'critical',
      reasons: ['slow p95 1280ms exceeds 1200ms budget', 'slow event count 1 exceeds 0 budget'],
      budgetsMs: {
        freshAggregateP95: 600,
        slowP95: 1200
      }
    });
    expect(analysis.latestSamples).toEqual([
      expect.objectContaining({
        event: 'runtime.platform_console.slow',
        timestamp: '2026-04-19T01:02:00.000Z'
      }),
      expect.objectContaining({
        event: 'runtime.platform_console.fresh_aggregate',
        timestamp: '2026-04-19T01:01:00.000Z'
      })
    ]);
  });

  it('formats a readable textual summary', () => {
    const output = formatPlatformConsoleLogAnalysis(
      analyzePlatformConsoleLogs([
        JSON.stringify({
          time: '2026-04-19T01:00:00.000Z',
          message: JSON.stringify({
            event: 'runtime.platform_console.slow',
            cacheStatus: 'miss',
            totalDurationMs: 1280,
            taskCount: 2,
            sessionCount: 1,
            timingsMs: { total: 1280, runtime: 480, evals: 510 }
          })
        })
      ])
    );

    expect(output).toContain('Platform console log samples: 1');
    expect(output).toContain('Summary: critical');
    expect(output).toContain('runtime.platform_console.slow: count=1');
    expect(output).toContain('runtime: p50=480ms p95=480ms max=480ms');
    expect(output).toContain('Latest samples:');
  });

  it('marks healthy windows when fresh aggregates stay within budget and no slow events exist', () => {
    const analysis = analyzePlatformConsoleLogs([
      JSON.stringify({
        time: '2026-04-19T01:00:00.000Z',
        message: JSON.stringify({
          event: 'runtime.platform_console.fresh_aggregate',
          totalDurationMs: 280,
          timingsMs: { total: 280, runtime: 100, evals: 110 }
        })
      }),
      JSON.stringify({
        time: '2026-04-19T01:01:00.000Z',
        message: JSON.stringify({
          event: 'runtime.platform_console.fresh_aggregate',
          totalDurationMs: 420,
          timingsMs: { total: 420, runtime: 150, evals: 170 }
        })
      })
    ]);

    expect(analysis.summary).toEqual({
      status: 'healthy',
      reasons: ['fresh p95 420ms within 600ms budget and no slow events detected'],
      budgetsMs: {
        freshAggregateP95: 600,
        slowP95: 1200
      }
    });
  });
});
