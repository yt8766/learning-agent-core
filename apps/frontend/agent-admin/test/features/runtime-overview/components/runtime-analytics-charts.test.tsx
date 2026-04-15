import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { RuntimeAnalyticsCharts } from '@/features/runtime-overview/components/runtime-analytics-charts';

vi.mock('@/components/dashboard-center-shell', () => ({
  DashboardEmptyState: ({ message }: { message: string }) => <div>{message}</div>
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
    Line: create('Line'),
    LineChart: create('LineChart'),
    Pie: create('Pie'),
    PieChart: create('PieChart'),
    XAxis: create('XAxis'),
    YAxis: create('YAxis')
  };
});

describe('RuntimeAnalyticsCharts', () => {
  const baseProps = {
    usageTrendData: [{ dayLabel: '3/30', tokens: 2000, costCny: 12 }],
    modelDistributionData: [{ model: 'gpt-5.4', tokens: 3000 }],
    providerBillingTrendData: [{ dayLabel: '3/30', totalTokens: 5000, costCny: 28 }],
    capacityData: [
      { name: 'activeSlots', value: 2, fill: 'red' },
      { name: 'availableSlots', value: 3, fill: 'blue' }
    ]
  };

  it('renders the area, bar, line, and capacity chart variants', () => {
    expect(renderToStaticMarkup(<RuntimeAnalyticsCharts {...baseProps} activeChart="area" />)).toContain('AreaChart');
    expect(renderToStaticMarkup(<RuntimeAnalyticsCharts {...baseProps} activeChart="bar" />)).toContain('BarChart');
    expect(renderToStaticMarkup(<RuntimeAnalyticsCharts {...baseProps} activeChart="line" />)).toContain('LineChart');
    expect(renderToStaticMarkup(<RuntimeAnalyticsCharts {...baseProps} activeChart="capacity" />)).toContain(
      'PieChart'
    );
  });

  it('renders empty states when the selected chart has no usable data', () => {
    expect(
      renderToStaticMarkup(<RuntimeAnalyticsCharts {...baseProps} activeChart="area" usageTrendData={[]} />)
    ).toContain('当前没有可用的 usage 趋势数据。');

    expect(
      renderToStaticMarkup(<RuntimeAnalyticsCharts {...baseProps} activeChart="bar" modelDistributionData={[]} />)
    ).toContain('当前还没有模型用量分布记录。');

    expect(
      renderToStaticMarkup(<RuntimeAnalyticsCharts {...baseProps} activeChart="line" providerBillingTrendData={[]} />)
    ).toContain('当前还没有 provider billing 历史可展示。');

    expect(
      renderToStaticMarkup(
        <RuntimeAnalyticsCharts
          {...baseProps}
          activeChart="capacity"
          capacityData={[
            { name: 'activeSlots', value: 0, fill: 'red' },
            { name: 'availableSlots', value: 0, fill: 'blue' }
          ]}
        />
      )
    ).toContain('当前没有可用的 worker / queue 压力指标。');
  });
});
