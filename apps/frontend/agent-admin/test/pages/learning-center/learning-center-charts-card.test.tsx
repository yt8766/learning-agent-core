import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('recharts', () => ({
  Bar: ({ children }: any) => <div>Bar{children}</div>,
  BarChart: ({ children }: any) => <div>BarChart{children}</div>,
  CartesianGrid: () => 'CartesianGrid',
  Cell: () => 'Cell',
  Pie: () => 'Pie',
  PieChart: ({ children }: any) => <div>PieChart{children}</div>,
  PolarAngleAxis: () => 'PolarAngleAxis',
  PolarGrid: () => 'PolarGrid',
  Radar: () => 'Radar',
  RadarChart: ({ children }: any) => <div>RadarChart{children}</div>,
  XAxis: () => 'XAxis',
  YAxis: () => 'YAxis'
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, size, variant, onClick }: any) => (
    <button className={`btn ${size ?? ''} ${variant ?? ''}`} onClick={onClick}>
      {children}
    </button>
  )
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: any) => <div className={className}>{children}</div>,
  CardContent: ({ children, className }: any) => <div className={className}>{children}</div>,
  CardHeader: ({ children, className }: any) => <div className={className}>{children}</div>,
  CardTitle: ({ children, className }: any) => <h3 className={className}>{children}</h3>
}));

vi.mock('@/components/ui/chart', () => ({
  ChartContainer: ({ children }: any) => <div>ChartContainer{children}</div>,
  ChartLegend: ({ children }: any) => <div>ChartLegend{children}</div>,
  ChartLegendContent: () => 'ChartLegendContent',
  ChartTooltip: ({ children }: any) => <div>ChartTooltip{children}</div>,
  ChartTooltipContent: () => 'ChartTooltipContent'
}));

vi.mock('@/components/dashboard-center-shell', () => ({
  DashboardEmptyState: ({ message }: { message: string }) => <div>{message}</div>
}));

import { LearningChartsCard } from '@/pages/learning-center/learning-center-charts-card';

describe('LearningChartsCard', () => {
  const defaultProps = {
    activeChart: 'queue' as const,
    onChartChange: vi.fn(),
    queueModeData: [
      { key: 'taskLearning', label: 'task-learning', value: 10 },
      { key: 'dreamTask', label: 'dream-task', value: 5 }
    ],
    conflictData: [
      { key: 'open', label: 'open', value: 3 },
      { key: 'merged', label: 'merged', value: 7 }
    ],
    ministryScoreData: [
      { ministry: 'finance', score: 85 },
      { ministry: 'hr', score: 72 }
    ],
    trustDistributionData: [
      { key: 'high', label: 'high', value: 20 },
      { key: 'medium', label: 'medium', value: 10 }
    ]
  };

  it('renders queue chart by default', () => {
    const html = renderToStaticMarkup(<LearningChartsCard {...defaultProps} />);

    expect(html).toContain('Learning Queue Structure');
    expect(html).toContain('PieChart');
  });

  it('renders conflict chart when activeChart is conflict', () => {
    const html = renderToStaticMarkup(<LearningChartsCard {...defaultProps} activeChart="conflict" />);

    expect(html).toContain('Conflict Governance');
    expect(html).toContain('BarChart');
  });

  it('renders ministry chart when activeChart is ministry', () => {
    const html = renderToStaticMarkup(<LearningChartsCard {...defaultProps} activeChart="ministry" />);

    expect(html).toContain('Ministry Scorecards');
    expect(html).toContain('RadarChart');
  });

  it('renders trust chart when activeChart is trust', () => {
    const html = renderToStaticMarkup(<LearningChartsCard {...defaultProps} activeChart="trust" />);

    expect(html).toContain('Capability Trust Distribution');
    expect(html).toContain('BarChart');
  });

  it('renders chart switch buttons', () => {
    const html = renderToStaticMarkup(<LearningChartsCard {...defaultProps} />);

    expect(html).toContain('Queue');
    expect(html).toContain('Conflict');
    expect(html).toContain('Ministry');
    expect(html).toContain('Trust');
  });

  it('renders empty state when queue data has no values', () => {
    const props = {
      ...defaultProps,
      queueModeData: [
        { key: 'taskLearning', label: 'task-learning', value: 0 },
        { key: 'dreamTask', label: 'dream-task', value: 0 }
      ]
    };
    const html = renderToStaticMarkup(<LearningChartsCard {...props} />);

    expect(html).toContain('当前还没有可视化的学习队列结构');
  });

  it('renders empty state when conflict data has no values', () => {
    const props = {
      ...defaultProps,
      activeChart: 'conflict' as const,
      conflictData: [
        { key: 'open', label: 'open', value: 0 },
        { key: 'merged', label: 'merged', value: 0 }
      ]
    };
    const html = renderToStaticMarkup(<LearningChartsCard {...props} />);

    expect(html).toContain('当前没有可视化的冲突治理数据');
  });

  it('renders empty state when ministry data is empty', () => {
    const props = {
      ...defaultProps,
      activeChart: 'ministry' as const,
      ministryScoreData: []
    };
    const html = renderToStaticMarkup(<LearningChartsCard {...props} />);

    expect(html).toContain('当前还没有 ministry 评分数据');
  });

  it('renders empty state when trust data has no values', () => {
    const props = {
      ...defaultProps,
      activeChart: 'trust' as const,
      trustDistributionData: [
        { key: 'high', label: 'high', value: 0 },
        { key: 'medium', label: 'medium', value: 0 }
      ]
    };
    const html = renderToStaticMarkup(<LearningChartsCard {...props} />);

    expect(html).toContain('当前还没有 capability trust 分布');
  });
});
