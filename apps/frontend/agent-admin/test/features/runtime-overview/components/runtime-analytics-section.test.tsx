import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { RuntimeAnalyticsSection } from '@/features/runtime-overview/components/runtime-analytics-section';

describe('RuntimeAnalyticsSection render smoke', () => {
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
    expect(html).toContain('当前没有可用的 usage 趋势数据。');
    expect(html).toContain('当前还没有可用的 usage 审计记录。');
  });
});
