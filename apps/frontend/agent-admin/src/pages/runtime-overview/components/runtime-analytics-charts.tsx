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
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent
} from '@/components/ui/chart';

import {
  runtimeAreaConfig,
  runtimeBillingConfig,
  runtimeCapacityConfig,
  runtimeModelConfig,
  type RuntimeChartView
} from './runtime-analytics-support';

export interface RuntimeAnalyticsChartsProps {
  activeChart: RuntimeChartView;
  usageTrendData: Array<{ dayLabel: string; tokens: number; costCny: number }>;
  modelDistributionData: Array<{ model: string; tokens: number }>;
  providerBillingTrendData: Array<{ dayLabel: string; totalTokens: number; costCny: number }>;
  capacityData: Array<{ name: string; value: number; fill: string }>;
}

export function RuntimeAnalyticsCharts({
  activeChart,
  usageTrendData,
  modelDistributionData,
  providerBillingTrendData,
  capacityData
}: RuntimeAnalyticsChartsProps) {
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
}
