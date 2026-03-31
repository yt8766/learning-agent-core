import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { EvalsCenterPanel } from '@/features/evals-center/evals-center-panel';

describe('EvalsCenterPanel render smoke', () => {
  it('renders eval dashboard sections and filters', () => {
    const html = renderToStaticMarkup(
      <EvalsCenterPanel
        evals={
          {
            scenarioCount: 8,
            runCount: 20,
            overallPassRate: 72,
            dailyTrend: [{ day: '2026-03-30', runCount: 5, passCount: 4, passRate: 80 }],
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
            promptRegression: {
              promptSuiteCount: 1,
              promptCount: 2,
              testCount: 3,
              providerCount: 1,
              configPath: '/tmp/prompts',
              latestRun: {
                overallStatus: 'pass',
                summaryPath: '/tmp/prompts/latest.json',
                runAt: '2026-03-30T10:00:00.000Z',
                passRate: 100,
                providerIds: ['openai'],
                suiteResults: []
              },
              suites: [{ suiteId: 'suite-1', label: 'Core prompts', promptCount: 2, versions: ['v1'] }]
            }
          } as any
        }
        historyDays={30}
        onHistoryDaysChange={vi.fn()}
        scenarioFilter=""
        onScenarioFilterChange={vi.fn()}
        outcomeFilter=""
        onOutcomeFilterChange={vi.fn()}
        onExport={vi.fn()}
      />
    );

    expect(html).toContain('Evals Center');
    expect(html).toContain('Daily Trend');
    expect(html).toContain('Prompt Regressions');
    expect(html).toContain('Benchmark Scenarios');
    expect(html).toContain('Recent Benchmark Runs');
    expect(html).toContain('VIP retention');
  });
});
