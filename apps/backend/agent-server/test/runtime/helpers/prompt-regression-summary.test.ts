import { describe, expect, it } from 'vitest';

import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  loadPromptRegressionConfigSummary,
  parsePromptfooConfigSummary
} from '../../../src/runtime/helpers/prompt-regression-summary';

describe('prompt-regression-summary', () => {
  it('parses promptfoo suites, tests and providers from config text', () => {
    const summary = parsePromptfooConfigSummary(`
prompts:
  - id: supervisor-plan-v1
    label: "首辅规划 v1 基线"
  - id: supervisor-plan-v2
    label: "首辅规划 v2 结构化"
  - id: hubu-research-v1
    label: "户部研究 v1 基线"
providers:
  - id: openai:gpt-4o-mini
tests:
  - vars:
      goal: "demo"
  - vars:
      goal: "demo-2"
`);

    expect(summary.prompts).toHaveLength(3);
    expect(summary.providerCount).toBe(1);
    expect(summary.testCount).toBe(2);
    expect(summary.suites).toEqual([
      {
        suiteId: 'hubu-research',
        label: '户部研究',
        promptIds: ['hubu-research-v1'],
        versions: ['v1'],
        promptCount: 1
      },
      {
        suiteId: 'supervisor-plan',
        label: '首辅规划',
        promptIds: ['supervisor-plan-v1', 'supervisor-plan-v2'],
        versions: ['v1', 'v2'],
        promptCount: 2
      }
    ]);
  });

  it('loads latest prompt regression run summary when companion json exists', async () => {
    const root = await mkdtemp(join(tmpdir(), 'prompt-regression-summary-'));
    try {
      const promptfooDir = join(root, 'packages', 'evals', 'promptfoo');
      await mkdir(promptfooDir, { recursive: true });
      await writeFile(
        join(promptfooDir, 'ministry-prompts.promptfooconfig.yaml'),
        `prompts:\n  - id: hubu-research-v1\nproviders:\n  - id: openai:gpt-4o-mini\ntests:\n  - vars:\n      goal: "demo"\n`,
        'utf8'
      );
      await writeFile(
        join(promptfooDir, 'latest-summary.json'),
        JSON.stringify({
          runAt: '2026-03-28T00:00:00.000Z',
          overallStatus: 'partial',
          passRate: 80,
          providerIds: ['openai:gpt-4o-mini'],
          suiteResults: [
            {
              suiteId: 'hubu-research',
              label: '户部研究',
              status: 'pass',
              passRate: 100,
              promptResults: [
                {
                  promptId: 'hubu-research-v1',
                  version: 'v1',
                  providerId: 'openai:gpt-4o-mini',
                  pass: true
                }
              ]
            }
          ]
        }),
        'utf8'
      );

      const summary = await loadPromptRegressionConfigSummary(root);

      expect(summary?.latestRun).toEqual(
        expect.objectContaining({
          summaryPath: 'packages/evals/promptfoo/latest-summary.json',
          overallStatus: 'partial',
          passRate: 80,
          providerIds: ['openai:gpt-4o-mini'],
          suiteResults: [
            expect.objectContaining({
              suiteId: 'hubu-research',
              status: 'pass',
              promptResults: [
                expect.objectContaining({
                  promptId: 'hubu-research-v1',
                  version: 'v1',
                  pass: true
                })
              ]
            })
          ]
        })
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
