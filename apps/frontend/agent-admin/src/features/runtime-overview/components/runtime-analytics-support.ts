import type { ChartConfig } from '@/components/ui/chart';

export type RuntimeChartView = 'area' | 'bar' | 'line' | 'capacity';

export const runtimeChartTabs: Array<{
  id: RuntimeChartView;
  label: string;
  title: string;
  description: string;
}> = [
  {
    id: 'area',
    label: 'Area',
    title: 'Usage Trend',
    description: '按天查看 tokens 与成本波动，快速判断预算压力。'
  },
  {
    id: 'bar',
    label: 'Bar',
    title: 'Model Distribution',
    description: '查看各模型的 token 占比与调用分布。'
  },
  {
    id: 'line',
    label: 'Line',
    title: 'Provider Billing',
    description: '展示 provider 实测同步后的 token 与成本趋势。'
  },
  {
    id: 'capacity',
    label: 'Capacity',
    title: 'Worker Capacity',
    description: '查看 worker 槽位、队列深度与阻塞压力。'
  }
];

export const runtimeAreaConfig = {
  tokens: { label: 'Tokens', color: 'var(--chart-1)' },
  costCny: { label: 'Cost (CNY)', color: 'var(--chart-2)' }
} satisfies ChartConfig;

export const runtimeModelConfig = {
  tokens: { label: 'Tokens', color: 'var(--chart-2)' }
} satisfies ChartConfig;

export const runtimeBillingConfig = {
  totalTokens: { label: 'Total Tokens', color: 'var(--chart-1)' },
  costCny: { label: 'Cost (CNY)', color: 'var(--chart-3)' }
} satisfies ChartConfig;

export const runtimeCapacityConfig = {
  activeSlots: { label: 'Active Slots', color: 'var(--chart-1)' },
  availableSlots: { label: 'Available Slots', color: 'var(--chart-2)' },
  queueDepth: { label: 'Queue Depth', color: 'var(--chart-3)' },
  blockedRuns: { label: 'Blocked Runs', color: 'var(--chart-4)' }
} satisfies ChartConfig;

export function formatDayLabel(day: string) {
  const date = new Date(day);
  if (Number.isNaN(date.getTime())) {
    return day;
  }
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

export function buildUsageTrendData(
  usageHistory: Array<{ day: string; tokens: number; costCny: number; runs: number }>
) {
  return usageHistory.map(item => ({
    day: item.day,
    dayLabel: formatDayLabel(item.day),
    tokens: item.tokens,
    costCny: item.costCny,
    runs: item.runs
  }));
}

export function buildModelDistributionData(
  models: Array<{ model: string; tokens: number; costCny: number; runCount: number }>
) {
  return models.map(item => ({
    model: item.model,
    tokens: item.tokens,
    costCny: item.costCny,
    runCount: item.runCount
  }));
}

export function buildProviderBillingTrendData(
  history: Array<{ day: string; totalTokens: number; costCny: number; runs: number }> = []
) {
  return history.map(item => ({
    day: item.day,
    dayLabel: formatDayLabel(item.day),
    totalTokens: item.totalTokens,
    costCny: item.costCny,
    runs: item.runs
  }));
}

export function buildCapacityData(runtime: {
  activeWorkerSlotCount?: number;
  availableWorkerSlotCount?: number;
  queueDepth?: number;
  blockedRunCount?: number;
}) {
  return [
    {
      name: 'activeSlots',
      label: 'Active Slots',
      value: runtime.activeWorkerSlotCount ?? 0,
      fill: 'var(--color-activeSlots)'
    },
    {
      name: 'availableSlots',
      label: 'Available Slots',
      value: runtime.availableWorkerSlotCount ?? 0,
      fill: 'var(--color-availableSlots)'
    },
    {
      name: 'queueDepth',
      label: 'Queue Depth',
      value: runtime.queueDepth ?? 0,
      fill: 'var(--color-queueDepth)'
    },
    {
      name: 'blockedRuns',
      label: 'Blocked Runs',
      value: runtime.blockedRunCount ?? 0,
      fill: 'var(--color-blockedRuns)'
    }
  ];
}
