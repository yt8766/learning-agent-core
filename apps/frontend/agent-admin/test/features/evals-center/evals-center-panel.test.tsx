import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { renderedButtons, setActiveChartMock } = vi.hoisted(() => ({
  renderedButtons: [] as Array<{ children?: unknown; onClick?: () => void }>,
  setActiveChartMock: vi.fn()
}));

function getButtonText(children: unknown): string {
  if (Array.isArray(children)) {
    return children.map(getButtonText).join('');
  }
  if (children === null || children === undefined || typeof children === 'boolean') {
    return '';
  }
  return String(children);
}

vi.mock('react', async importOriginal => {
  const actual = await importOriginal<typeof import('react')>();
  return {
    ...actual,
    useState: ((initialValue: unknown) => [initialValue, setActiveChartMock]) as unknown as typeof actual.useState
  };
});

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick }: { children?: unknown; onClick?: () => void }) => {
    renderedButtons.push({ children, onClick });
    return <button>{children as any}</button>;
  }
}));

vi.mock('@/components/ui/chart', () => ({
  ChartContainer: ({ children }: { children?: ReactNode }) => <section>{children}</section>,
  ChartLegend: ({ content }: { content?: ReactNode }) => <div>{content}</div>,
  ChartLegendContent: () => <span>legend</span>,
  ChartTooltip: ({ content }: { content?: ReactNode }) => <div>{content}</div>,
  ChartTooltipContent: () => <span>tooltip</span>
}));

vi.mock('recharts', () => {
  const create =
    (name: string) =>
    ({ children }: { children?: ReactNode }) => <div data-chart={name}>{children}</div>;
  return {
    Area: create('Area'),
    AreaChart: create('AreaChart'),
    Bar: create('Bar'),
    BarChart: create('BarChart'),
    CartesianGrid: create('CartesianGrid'),
    Cell: create('Cell'),
    Pie: create('Pie'),
    PieChart: create('PieChart'),
    XAxis: create('XAxis'),
    YAxis: create('YAxis')
  };
});

import { EvalsCenterPanel } from '@/features/evals-center/evals-center-panel';

describe('EvalsCenterPanel', () => {
  beforeEach(() => {
    renderedButtons.length = 0;
    setActiveChartMock.mockReset();
  });

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

    expect(html).toContain('评测基线');
    expect(html).toContain('每日趋势');
    expect(html).toContain('趋势');
    expect(html).toContain('套件');
    expect(html).toContain('通过率');
    expect(html).toContain('Prompt 回归');
    expect(html).toContain('基准场景');
    expect(html).toContain('近期基准运行');
    expect(html).toContain('VIP retention');
  });

  it('routes export, history-window and chart-tab actions through callbacks', () => {
    const onHistoryDaysChange = vi.fn();
    const onExport = vi.fn();

    renderToStaticMarkup(
      <EvalsCenterPanel
        evals={
          {
            scenarioCount: 8,
            runCount: 20,
            overallPassRate: 72,
            dailyTrend: [{ day: '2026-03-30', runCount: 5, passCount: 4, passRate: 80 }],
            scenarios: [],
            recentRuns: [],
            promptRegression: {
              promptSuiteCount: 0,
              promptCount: 0,
              testCount: 0,
              providerCount: 0,
              configPath: '/tmp/prompts',
              suites: []
            }
          } as any
        }
        historyDays={30}
        onHistoryDaysChange={onHistoryDaysChange}
        scenarioFilter=""
        onScenarioFilterChange={vi.fn()}
        outcomeFilter=""
        onOutcomeFilterChange={vi.fn()}
        onExport={onExport}
      />
    );

    renderedButtons.find(item => getButtonText(item.children) === '导出')?.onClick?.();
    renderedButtons.filter(item => getButtonText(item.children) === '导出')[1]?.onClick?.();
    renderedButtons.find(item => getButtonText(item.children) === '7天')?.onClick?.();
    renderedButtons.find(item => getButtonText(item.children) === '90天')?.onClick?.();
    renderedButtons.find(item => getButtonText(item.children) === '趋势')?.onClick?.();
    renderedButtons.find(item => getButtonText(item.children) === '套件')?.onClick?.();
    renderedButtons.find(item => getButtonText(item.children) === '通过率')?.onClick?.();

    expect(onExport).toHaveBeenCalledTimes(2);
    expect(onHistoryDaysChange).toHaveBeenNthCalledWith(1, 7);
    expect(onHistoryDaysChange).toHaveBeenNthCalledWith(2, 90);
    expect(setActiveChartMock).toHaveBeenNthCalledWith(1, 'trend');
    expect(setActiveChartMock).toHaveBeenNthCalledWith(2, 'suites');
    expect(setActiveChartMock).toHaveBeenNthCalledWith(3, 'passRate');
  });
});
