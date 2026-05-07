import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import fs from 'fs-extra';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { runPlatformConsoleAcceptanceWorkflow } from '../../src/logger/platform-console-acceptance-orchestrator';

describe('platform-console-acceptance-orchestrator', () => {
  let tmpRoot: string;

  beforeEach(async () => {
    tmpRoot = await mkdtemp(join(tmpdir(), 'platform-console-acceptance-orchestrator-'));
  });

  afterEach(async () => {
    await fs.remove(tmpRoot);
  });

  it('writes the current report, comparison, log analysis, and markdown acceptance draft', async () => {
    const outputDir = join(tmpRoot, 'artifacts');
    const baselineJsonPath = join(tmpRoot, 'baseline.json');
    await fs.outputJson(
      baselineJsonPath,
      {
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
      { spaces: 2 }
    );

    const result = await runPlatformConsoleAcceptanceWorkflow({
      baseUrl: 'https://staging.example.com',
      outputDir,
      baselineJsonPath,
      reviewer: 'Codex',
      version: 'codex/platform-console-optimization',
      goal: '验证 platform console 优化结果',
      date: '2026-04-19',
      measureReport: async () => ({
        url: 'https://staging.example.com/api/platform/console?days=30',
        sampleCount: 5,
        warmupCount: 1,
        requestDurationMs: { min: 180, max: 920, avg: 460, p50: 420, p95: 900 },
        serverTotalDurationMs: { min: 140, max: 760, avg: 350, p50: 300, p95: 720 },
        cacheStatusCounts: { hit: 4, miss: 1 },
        budgetsMs: { requestP95: 1000, serverTotalP95: 1000 },
        failedBudgets: [],
        samples: []
      }),
      fetchLogAnalysis: async () => ({
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
      })
    });

    expect(result.paths.currentJsonPath).toBe(join(outputDir, 'platform-console-current.json'));
    expect(result.paths.comparisonJsonPath).toBe(join(outputDir, 'platform-console-comparison.json'));
    expect(result.paths.logAnalysisJsonPath).toBe(join(outputDir, 'platform-console-log-analysis.json'));
    expect(result.paths.acceptanceMarkdownPath).toBe(join(outputDir, 'platform-console-acceptance.md'));

    await expect(fs.pathExists(result.paths.currentJsonPath)).resolves.toBe(true);
    await expect(fs.pathExists(result.paths.comparisonJsonPath)).resolves.toBe(true);
    await expect(fs.pathExists(result.paths.logAnalysisJsonPath)).resolves.toBe(true);
    await expect(fs.pathExists(result.paths.acceptanceMarkdownPath)).resolves.toBe(true);

    const markdown = await fs.readFile(result.paths.acceptanceMarkdownPath, 'utf8');
    expect(markdown).toContain('# Platform Console Staging Acceptance');
    expect(markdown).toContain('- comparison status：improved');
    expect(markdown).toContain('- `summary.status`：healthy');
    expect(markdown).toContain('- 是否通过：通过');
  });
});
