import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { BenchmarkSections, PromptRegressionSection } from '@/features/evals-center/evals-center-sections';
import type { EvalsCenterRecord } from '@/types/admin';

function createEvalsRecord(overrides?: Partial<EvalsCenterRecord>): EvalsCenterRecord {
  return {
    scenarioCount: 1,
    runCount: 1,
    overallPassRate: 75,
    scenarios: [
      {
        scenarioId: 'vip-retention',
        label: 'VIP retention',
        description: '验证 VIP 承接链路',
        passRate: 75,
        matchedRunCount: 4,
        passCount: 3,
        failCount: 1
      }
    ],
    recentRuns: [
      {
        taskId: 'task-eval-1',
        createdAt: '2026-03-30T10:00:00.000Z',
        success: true,
        scenarioIds: ['vip-retention']
      }
    ],
    dailyTrend: [{ day: '2026-03-30', runCount: 4, passCount: 3, passRate: 75 }],
    scenarioTrends: [],
    promptRegression: {
      configPath: '/tmp/prompts',
      promptCount: 2,
      promptSuiteCount: 1,
      testCount: 3,
      providerCount: 1,
      updatedAt: '2026-03-30T09:00:00.000Z',
      latestRun: {
        summaryPath: '/tmp/prompts/latest.json',
        runAt: '2026-03-30T10:00:00.000Z',
        overallStatus: 'partial',
        passRate: 67,
        providerIds: ['openai'],
        suiteResults: [
          {
            suiteId: 'suite-1',
            label: 'Core prompts',
            status: 'partial',
            passRate: 67,
            notes: ['需要复核提示词 A'],
            promptResults: [
              { promptId: 'prompt-1', version: 'v1', pass: true },
              { promptId: 'prompt-2', version: 'v2', pass: false }
            ]
          }
        ]
      },
      suites: [{ suiteId: 'suite-1', label: 'Core prompts', promptIds: ['prompt-1'], versions: ['v1'], promptCount: 2 }]
    },
    ...overrides
  };
}

describe('PromptRegressionSection', () => {
  it('renders prompt regression run details, suite notes and prompt results', () => {
    const html = renderToStaticMarkup(<PromptRegressionSection evals={createEvalsRecord()} />);

    expect(html).toContain('Prompt Regressions');
    expect(html).toContain('/tmp/prompts');
    expect(html).toContain('配置更新时间 2026-03-30T09:00:00.000Z');
    expect(html).toContain('Latest Prompt Run');
    expect(html).toContain('/tmp/prompts/latest.json');
    expect(html).toContain('partial');
    expect(html).toContain('通过率 67%');
    expect(html).toContain('需要复核提示词 A');
    expect(html).toContain('v1 pass');
    expect(html).toContain('v2 fail');
  });

  it('renders empty states when prompt regression data or latest run summary is missing', () => {
    const noConfigHtml = renderToStaticMarkup(
      <PromptRegressionSection evals={createEvalsRecord({ promptRegression: undefined })} />
    );
    const noLatestRunHtml = renderToStaticMarkup(
      <PromptRegressionSection
        evals={createEvalsRecord({
          promptRegression: {
            configPath: '/tmp/prompts',
            promptCount: 0,
            promptSuiteCount: 0,
            testCount: 0,
            providerCount: 0,
            suites: []
          }
        })}
      />
    );

    expect(noConfigHtml).toContain('当前还没有可用的 prompt 回归配置概览。');
    expect(noLatestRunHtml).toContain('当前还没有最近一次 prompt 回归结果摘要。');
  });
});

describe('BenchmarkSections', () => {
  it('renders benchmark filters, scenarios and recent benchmark runs', () => {
    const html = renderToStaticMarkup(
      <BenchmarkSections
        evals={createEvalsRecord()}
        scenarioFilter=""
        onScenarioFilterChange={() => undefined}
        outcomeFilter=""
        onOutcomeFilterChange={() => undefined}
      />
    );

    expect(html).toContain('Benchmark Scenarios');
    expect(html).toContain('Benchmark Filters');
    expect(html).toContain('场景筛选');
    expect(html).toContain('结果筛选');
    expect(html).toContain('VIP retention');
    expect(html).toContain('命中 4');
    expect(html).toContain('通过 3');
    expect(html).toContain('失败 1');
    expect(html).toContain('Recent Benchmark Runs');
    expect(html).toContain('task-eval-1');
    expect(html).toContain('vip-retention');
    expect(html).toContain('pass');
  });

  it('renders the recent-run empty state when no benchmark runs are available', () => {
    const html = renderToStaticMarkup(
      <BenchmarkSections
        evals={createEvalsRecord({ recentRuns: [] })}
        scenarioFilter=""
        onScenarioFilterChange={() => undefined}
        outcomeFilter=""
        onOutcomeFilterChange={() => undefined}
      />
    );

    expect(html).toContain('当前还没有命中 benchmark 的运行记录。');
  });
});
