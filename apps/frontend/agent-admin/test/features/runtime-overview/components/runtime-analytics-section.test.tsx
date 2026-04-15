import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let useStateOverride:
  | ((actualUseState: (initialState?: unknown) => unknown, initialState?: unknown) => unknown)
  | null = null;
const renderedButtons: Array<{ children?: unknown; onClick?: () => void }> = [];
const renderedChartProps: Array<Record<string, unknown>> = [];

function normalizeButtonLabel(children: unknown) {
  return Array.isArray(children) ? children.join('') : String(children);
}

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  const actualUseState = actual.useState as unknown as (initialState?: unknown) => unknown;

  return {
    ...actual,
    useState: ((initialState?: unknown) => {
      if (useStateOverride) {
        return useStateOverride(actualUseState, initialState);
      }
      return actualUseState(initialState);
    }) as typeof actual.useState
  };
});

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick }: { children?: unknown; onClick?: () => void }) => {
    renderedButtons.push({ children, onClick });
    return <button>{children as any}</button>;
  }
}));

vi.mock('@/features/runtime-overview/components/runtime-analytics-charts', () => ({
  RuntimeAnalyticsCharts: (props: Record<string, unknown>) => {
    renderedChartProps.push(props);
    return <div>runtime-analytics-charts</div>;
  }
}));

import { RuntimeAnalyticsSection } from '@/features/runtime-overview/components/runtime-analytics-section';

describe('RuntimeAnalyticsSection render smoke', () => {
  beforeEach(() => {
    renderedButtons.length = 0;
    renderedChartProps.length = 0;
    useStateOverride = null;
  });

  it('renders billing audit, chart workspace, and usage audit details', () => {
    const html = renderToStaticMarkup(
      <RuntimeAnalyticsSection
        runtime={
          {
            usageAnalytics: {
              historyDays: 30,
              historyRange: {
                earliestDay: '2026-03-01',
                latestDay: '2026-03-30'
              },
              providerBillingStatus: {
                status: 'enabled',
                provider: 'openai',
                source: 'billing-export',
                syncedAt: '2026-03-30T08:00:00.000Z',
                message: '最近一次同步成功。'
              },
              providerBillingTotals: {
                totalTokens: 123456,
                costCny: 234.56,
                runs: 18
              },
              daily: [
                {
                  day: '2026-03-30',
                  runs: 6,
                  tokens: 30000,
                  costCny: 50,
                  overBudget: false
                }
              ],
              persistedDailyHistory: [
                {
                  day: '2026-03-29',
                  runs: 8,
                  tokens: 42000,
                  costCny: 72.5,
                  overBudget: true
                }
              ],
              models: [
                {
                  model: 'gpt-5.4',
                  runCount: 9,
                  tokens: 64000,
                  costCny: 120.3,
                  costUsd: 16.54
                }
              ],
              recentUsageAudit: [
                {
                  taskId: 'task-1',
                  day: '2026-03-30',
                  updatedAt: '2026-03-30T08:30:00.000Z',
                  totalTokens: 24000,
                  totalCostCny: 38.4,
                  modelBreakdown: [
                    {
                      model: 'gpt-5.4',
                      pricingSource: 'provider-billing'
                    }
                  ]
                }
              ]
            }
          } as any
        }
        historyDays={30}
        onHistoryDaysChange={vi.fn()}
      />
    );

    expect(html).toContain('Provider Billing Audit');
    expect(html).toContain('billing-export');
    expect(html).toContain('最近一次同步成功。');
    expect(html).toContain('Usage Trend');
    expect(html).toContain('Area');
    expect(html).toContain('Bar');
    expect(html).toContain('Line');
    expect(html).toContain('Capacity');
    expect(html).toContain('归档范围 2026-03-01 - 2026-03-30');
    expect(html).toContain('当前 1 天 / 持久化 30 天');
    expect(html).toContain('Usage Audit');
    expect(html).toContain('provider-billing');
  });

  it('renders empty states when analytics data is unavailable', () => {
    const html = renderToStaticMarkup(
      <RuntimeAnalyticsSection
        runtime={
          {
            usageAnalytics: {
              historyDays: 0,
              providerBillingStatus: null,
              providerBillingTotals: null,
              daily: [],
              persistedDailyHistory: [],
              models: [],
              recentUsageAudit: []
            }
          } as any
        }
        historyDays={7}
        onHistoryDaysChange={vi.fn()}
      />
    );

    expect(html).toContain('disabled');
    expect(html).toContain('Provider unknown / 来源 unconfigured / 尚未同步');
    expect(html).toContain('runtime-analytics-charts');
    expect(html).toContain('当前还没有可用的 usage 审计记录。');
    expect(renderedChartProps[0]).toEqual(
      expect.objectContaining({
        activeChart: 'area'
      })
    );
  });

  it('routes history day filters and chart tab state changes through the component shell', () => {
    const onHistoryDaysChange = vi.fn();

    renderToStaticMarkup(
      <RuntimeAnalyticsSection
        runtime={
          {
            usageAnalytics: {
              historyDays: 30,
              providerBillingStatus: null,
              providerBillingTotals: null,
              daily: [{ day: '2026-03-30', runs: 1, tokens: 1000, costCny: 1, overBudget: false }],
              persistedDailyHistory: [],
              models: [],
              recentUsageAudit: []
            }
          } as any
        }
        historyDays={30}
        onHistoryDaysChange={onHistoryDaysChange}
      />
    );

    expect(renderedButtons.map(button => normalizeButtonLabel(button.children))).toEqual(
      expect.arrayContaining(['7d', '30d', '90d', 'Area', 'Bar', 'Line', 'Capacity'])
    );

    renderedButtons[0]?.onClick?.();
    renderedButtons[2]?.onClick?.();

    expect(onHistoryDaysChange).toHaveBeenNthCalledWith(1, 7);
    expect(onHistoryDaysChange).toHaveBeenNthCalledWith(2, 90);
  });

  it('passes the active chart selection down to RuntimeAnalyticsCharts', () => {
    let stateCallIndex = 0;
    useStateOverride = (actualUseState, initial) => {
      stateCallIndex += 1;
      if (stateCallIndex === 1) {
        return ['capacity', vi.fn()];
      }
      return actualUseState(initial);
    };

    renderToStaticMarkup(
      <RuntimeAnalyticsSection
        runtime={
          {
            usageAnalytics: {
              historyDays: 30,
              providerBillingStatus: null,
              providerBillingTotals: null,
              daily: [{ day: '2026-03-30', runs: 1, tokens: 1000, costCny: 1, overBudget: false }],
              persistedDailyHistory: [],
              models: [],
              recentUsageAudit: []
            }
          } as any
        }
        historyDays={30}
        onHistoryDaysChange={vi.fn()}
      />
    );

    expect(renderedChartProps[0]).toEqual(
      expect.objectContaining({
        activeChart: 'capacity'
      })
    );
  });
});
