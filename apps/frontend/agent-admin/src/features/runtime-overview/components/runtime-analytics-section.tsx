import { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis
} from 'recharts';

import { DashboardEmptyState } from '@/components/dashboard-center-shell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig
} from '@/components/ui/chart';

import type { RuntimeOverviewPanelProps } from './runtime-overview-types';

type RuntimeChartView = 'area' | 'bar' | 'line' | 'capacity';

const runtimeChartTabs: Array<{ id: RuntimeChartView; label: string; title: string; description: string }> = [
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

const runtimeAreaConfig = {
  tokens: { label: 'Tokens', color: 'var(--chart-1)' },
  costCny: { label: 'Cost (CNY)', color: 'var(--chart-2)' }
} satisfies ChartConfig;

const runtimeModelConfig = {
  tokens: { label: 'Tokens', color: 'var(--chart-2)' }
} satisfies ChartConfig;

const runtimeBillingConfig = {
  totalTokens: { label: 'Total Tokens', color: 'var(--chart-1)' },
  costCny: { label: 'Cost (CNY)', color: 'var(--chart-3)' }
} satisfies ChartConfig;

const runtimeCapacityConfig = {
  activeSlots: { label: 'Active Slots', color: 'var(--chart-1)' },
  availableSlots: { label: 'Available Slots', color: 'var(--chart-2)' },
  queueDepth: { label: 'Queue Depth', color: 'var(--chart-3)' },
  blockedRuns: { label: 'Blocked Runs', color: 'var(--chart-4)' }
} satisfies ChartConfig;

export function RuntimeAnalyticsSection({
  runtime,
  historyDays,
  onHistoryDaysChange
}: Pick<RuntimeOverviewPanelProps, 'runtime' | 'historyDays' | 'onHistoryDaysChange'>) {
  const [activeChart, setActiveChart] = useState<RuntimeChartView>('area');

  const usageHistory = runtime.usageAnalytics.persistedDailyHistory?.length
    ? runtime.usageAnalytics.persistedDailyHistory
    : runtime.usageAnalytics.daily;
  const chartMeta = runtimeChartTabs.find(item => item.id === activeChart) ?? runtimeChartTabs[0];

  const usageTrendData = useMemo(
    () =>
      usageHistory.map(item => ({
        day: item.day,
        dayLabel: formatDayLabel(item.day),
        tokens: item.tokens,
        costCny: item.costCny,
        runs: item.runs
      })),
    [usageHistory]
  );

  const modelDistributionData = useMemo(
    () =>
      runtime.usageAnalytics.models.map(item => ({
        model: item.model,
        tokens: item.tokens,
        costCny: item.costCny,
        runCount: item.runCount
      })),
    [runtime.usageAnalytics.models]
  );

  const providerBillingTrendData = useMemo(
    () =>
      (runtime.usageAnalytics.providerBillingDailyHistory ?? []).map(item => ({
        day: item.day,
        dayLabel: formatDayLabel(item.day),
        totalTokens: item.totalTokens,
        costCny: item.costCny,
        runs: item.runs
      })),
    [runtime.usageAnalytics.providerBillingDailyHistory]
  );

  const capacityData = useMemo(
    () => [
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
    ],
    [runtime.activeWorkerSlotCount, runtime.availableWorkerSlotCount, runtime.blockedRunCount, runtime.queueDepth]
  );

  const renderRuntimeChart = () => {
    if (activeChart === 'area') {
      if (!usageTrendData.length) {
        return <DashboardEmptyState message="当前没有可用的 usage 趋势数据。" />;
      }
      return (
        <ChartContainer config={runtimeAreaConfig}>
          <AreaChart data={usageTrendData} margin={{ left: 8, right: 8, top: 12, bottom: 4 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="dayLabel" tickLine={false} axisLine={false} />
            <YAxis yAxisId="tokens" tickLine={false} axisLine={false} width={56} />
            <YAxis yAxisId="cost" orientation="right" tickLine={false} axisLine={false} width={56} />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={value => `日期 ${value ?? ''}`}
                  formatter={(value, name) =>
                    name === 'costCny' ? `¥${Number(value).toFixed(2)}` : Number(value).toLocaleString()
                  }
                />
              }
            />
            <ChartLegend content={<ChartLegendContent />} />
            <Area
              yAxisId="cost"
              type="monotone"
              dataKey="costCny"
              stroke="var(--color-costCny)"
              fill="var(--color-costCny)"
              fillOpacity={0.12}
              strokeWidth={2}
            />
            <Area
              yAxisId="tokens"
              type="monotone"
              dataKey="tokens"
              stroke="var(--color-tokens)"
              fill="var(--color-tokens)"
              fillOpacity={0.22}
              strokeWidth={2}
            />
          </AreaChart>
        </ChartContainer>
      );
    }

    if (activeChart === 'bar') {
      if (!modelDistributionData.length) {
        return <DashboardEmptyState message="当前还没有模型用量分布记录。" />;
      }
      return (
        <ChartContainer config={runtimeModelConfig}>
          <BarChart data={modelDistributionData} margin={{ left: 8, right: 8, top: 12, bottom: 4 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="model" tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} width={56} />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={value => `模型 ${value ?? ''}`}
                  formatter={value => Number(value).toLocaleString()}
                />
              }
            />
            <Bar dataKey="tokens" radius={[10, 10, 4, 4]} fill="var(--color-tokens)" />
          </BarChart>
        </ChartContainer>
      );
    }

    if (activeChart === 'line') {
      if (!providerBillingTrendData.length) {
        return <DashboardEmptyState message="当前还没有 provider billing 历史可展示。" />;
      }
      return (
        <ChartContainer config={runtimeBillingConfig}>
          <LineChart data={providerBillingTrendData} margin={{ left: 8, right: 8, top: 12, bottom: 4 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="dayLabel" tickLine={false} axisLine={false} />
            <YAxis yAxisId="tokens" tickLine={false} axisLine={false} width={56} />
            <YAxis yAxisId="cost" orientation="right" tickLine={false} axisLine={false} width={56} />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={value => `日期 ${value ?? ''}`}
                  formatter={(value, name) =>
                    name === 'costCny' ? `¥${Number(value).toFixed(2)}` : Number(value).toLocaleString()
                  }
                />
              }
            />
            <ChartLegend content={<ChartLegendContent />} />
            <Line
              yAxisId="tokens"
              type="monotone"
              dataKey="totalTokens"
              stroke="var(--color-totalTokens)"
              strokeWidth={2.5}
              dot={false}
            />
            <Line
              yAxisId="cost"
              type="monotone"
              dataKey="costCny"
              stroke="var(--color-costCny)"
              strokeWidth={2.5}
              dot={false}
            />
          </LineChart>
        </ChartContainer>
      );
    }

    if (!capacityData.some(item => item.value > 0)) {
      return <DashboardEmptyState message="当前没有可用的 worker / queue 压力指标。" />;
    }

    return (
      <ChartContainer config={runtimeCapacityConfig} className="h-[300px]">
        <PieChart>
          <ChartTooltip content={<ChartTooltipContent formatter={value => Number(value).toLocaleString()} />} />
          <Pie data={capacityData} dataKey="value" nameKey="name" innerRadius={70} outerRadius={110} paddingAngle={4}>
            {capacityData.map(item => (
              <Cell key={item.name} fill={item.fill} />
            ))}
          </Pie>
          <ChartLegend content={<ChartLegendContent />} />
        </PieChart>
      </ChartContainer>
    );
  };

  return (
    <>
      <Card className="border-border/70 bg-card/90 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-semibold text-foreground">Provider Billing Audit</CardTitle>
          <Badge variant="outline">{runtime.usageAnalytics.providerBillingStatus?.status ?? 'disabled'}</Badge>
        </CardHeader>
        <CardContent className="grid gap-3">
          <p className="text-sm text-muted-foreground">
            Provider {runtime.usageAnalytics.providerBillingStatus?.provider ?? 'unknown'} / 来源{' '}
            {runtime.usageAnalytics.providerBillingStatus?.source ?? 'unconfigured'} /
            {runtime.usageAnalytics.providerBillingStatus?.syncedAt
              ? ` 最近同步 ${runtime.usageAnalytics.providerBillingStatus.syncedAt}`
              : ' 尚未同步'}
          </p>
          {runtime.usageAnalytics.providerBillingStatus?.message ? (
            <p className="text-sm text-muted-foreground">{runtime.usageAnalytics.providerBillingStatus.message}</p>
          ) : null}
          {runtime.usageAnalytics.providerBillingTotals ? (
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">
                {runtime.usageAnalytics.providerBillingTotals.totalTokens.toLocaleString()} tokens
              </Badge>
              <Badge variant="secondary">¥{runtime.usageAnalytics.providerBillingTotals.costCny.toFixed(2)}</Badge>
              <Badge variant="secondary">{runtime.usageAnalytics.providerBillingTotals.runs} runs</Badge>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card/90 shadow-sm">
        <CardHeader className="gap-4 border-b border-[#ecece8] pb-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <CardTitle className="text-lg font-semibold text-foreground">{chartMeta.title}</CardTitle>
              <p className="text-sm text-muted-foreground">{chartMeta.description}</p>
            </div>
            <div className="flex items-center gap-2">
              {[7, 30, 90].map(option => (
                <Button
                  key={option}
                  size="sm"
                  variant={historyDays === option ? 'default' : 'outline'}
                  onClick={() => onHistoryDaysChange(option)}
                >
                  {option}d
                </Button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {runtimeChartTabs.map(item => (
              <Button
                key={item.id}
                size="sm"
                variant={activeChart === item.id ? 'default' : 'ghost'}
                onClick={() => setActiveChart(item.id)}
              >
                {item.label}
              </Button>
            ))}
            <Badge variant="outline">
              当前 {runtime.usageAnalytics.daily.length} 天 / 持久化{' '}
              {runtime.usageAnalytics.historyDays ?? usageHistory.length} 天
            </Badge>
          </div>
          {runtime.usageAnalytics.historyRange ? (
            <p className="text-xs text-muted-foreground">
              归档范围 {runtime.usageAnalytics.historyRange.earliestDay} -{' '}
              {runtime.usageAnalytics.historyRange.latestDay}
            </p>
          ) : null}
        </CardHeader>
        <CardContent className="pt-5">{renderRuntimeChart()}</CardContent>
      </Card>

      <Card className="border-border/70 bg-card/90 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-semibold text-foreground">Usage Audit</CardTitle>
          <Badge variant="outline">{runtime.usageAnalytics.recentUsageAudit?.length ?? 0}</Badge>
        </CardHeader>
        <CardContent className="grid gap-3">
          {runtime.usageAnalytics.recentUsageAudit?.length ? (
            runtime.usageAnalytics.recentUsageAudit.map(item => (
              <article
                key={`${item.taskId}-${item.updatedAt}`}
                className="rounded-2xl border border-border/70 bg-muted/30 px-4 py-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{item.taskId}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {item.day} / {item.updatedAt}
                    </p>
                  </div>
                  <Badge variant="outline">
                    {item.totalTokens.toLocaleString()} tokens / ¥{item.totalCostCny.toFixed(2)}
                  </Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {item.modelBreakdown.map(model => (
                    <span key={`${item.taskId}-${model.model}`}>
                      <Badge variant="secondary">
                        {model.model} / {model.pricingSource ?? 'estimated'}
                      </Badge>
                    </span>
                  ))}
                </div>
              </article>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">当前还没有可用的 usage 审计记录。</p>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function formatDayLabel(day: string) {
  const date = new Date(day);
  if (Number.isNaN(date.getTime())) {
    return day;
  }
  return `${date.getMonth() + 1}/${date.getDate()}`;
}
