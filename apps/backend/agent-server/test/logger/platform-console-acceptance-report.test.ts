import { describe, expect, it } from 'vitest';

import { renderPlatformConsoleAcceptanceReport } from '../../src/logger/platform-console-acceptance-report';

describe('platform-console-acceptance-report', () => {
  it('renders a staging acceptance markdown draft from benchmark and trend inputs', () => {
    const markdown = renderPlatformConsoleAcceptanceReport({
      metadata: {
        date: '2026-04-19',
        reviewer: 'Codex',
        environment: 'staging',
        version: 'codex/platform-console-optimization',
        goal: '验证平台控制台优化后的缓存命中、趋势恢复与预算收口',
        backendUrl: 'https://staging.example.com',
        baselineJsonPath: '/tmp/platform-console-baseline.json',
        currentJsonPath: '/tmp/platform-console-current.json'
      },
      currentReport: {
        url: 'https://staging.example.com/api/platform/console?days=30',
        sampleCount: 5,
        warmupCount: 1,
        requestDurationMs: { min: 180, max: 920, avg: 460, p50: 420, p95: 900 },
        serverTotalDurationMs: { min: 140, max: 760, avg: 350, p50: 300, p95: 720 },
        cacheStatusCounts: { hit: 4, miss: 1 },
        budgetsMs: { requestP95: 1000, serverTotalP95: 1000 },
        failedBudgets: [],
        samples: []
      },
      comparison: {
        status: 'improved',
        requestP95DeltaMs: -380,
        serverTotalP95DeltaMs: -220,
        cacheHitRateDelta: 0.4,
        highlights: [
          'request p95 improved by 380ms',
          'server total p95 improved by 220ms',
          'cache hit rate improved by 40pp'
        ],
        baseline: {
          url: 'https://staging.example.com/api/platform/console?days=30',
          sampleCount: 5,
          warmupCount: 1,
          requestDurationMs: { min: 220, max: 1320, avg: 610, p50: 550, p95: 1280 },
          serverTotalDurationMs: { min: 190, max: 980, avg: 470, p50: 430, p95: 940 },
          cacheStatusCounts: { hit: 2, miss: 3 },
          budgetsMs: { requestP95: 1000, serverTotalP95: 1000 },
          failedBudgets: ['request p95 1280ms exceeds 1000ms budget'],
          samples: []
        },
        current: {
          url: 'https://staging.example.com/api/platform/console?days=30',
          sampleCount: 5,
          warmupCount: 1,
          requestDurationMs: { min: 180, max: 920, avg: 460, p50: 420, p95: 900 },
          serverTotalDurationMs: { min: 140, max: 760, avg: 350, p50: 300, p95: 720 },
          cacheStatusCounts: { hit: 4, miss: 1 },
          budgetsMs: { requestP95: 1000, serverTotalP95: 1000 },
          failedBudgets: [],
          samples: []
        }
      },
      logAnalysis: {
        sampleCount: 4,
        summary: {
          status: 'healthy',
          reasons: ['fresh p95 420ms within 600ms budget and no slow events detected'],
          budgetsMs: {
            freshAggregateP95: 600,
            slowP95: 1200
          }
        },
        byEvent: {
          'runtime.platform_console.fresh_aggregate': {
            count: 4,
            totalDurationMs: { min: 280, max: 420, avg: 355, p50: 320, p95: 420 },
            timingPercentilesMs: {}
          }
        },
        latestSamples: []
      }
    });

    expect(markdown).toContain('# Platform Console Staging Acceptance');
    expect(markdown).toContain('- 验收日期：2026-04-19');
    expect(markdown).toContain('- request p95：900ms');
    expect(markdown).toContain('- comparison status：improved');
    expect(markdown).toContain('- request p95 delta：-380ms');
    expect(markdown).toContain('- `summary.status`：healthy');
    expect(markdown).toContain('- 是否通过：通过');
    expect(markdown).toContain('`request p95` 与 `server total p95` 均低于预算，趋势恢复 `healthy`，通过');
  });
});
