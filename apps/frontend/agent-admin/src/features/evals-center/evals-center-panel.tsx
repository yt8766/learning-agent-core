import { useMemo, useState } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from 'recharts';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig
} from '@/components/ui/chart';
import { DashboardCenterShell, DashboardEmptyState, DashboardMetricGrid } from '@/components/dashboard-center-shell';

import type { EvalsCenterRecord } from '@/types/admin';
import { BenchmarkSections, PromptRegressionSection } from './evals-center-sections';

interface EvalsCenterPanelProps {
  evals: EvalsCenterRecord;
  historyDays: number;
  onHistoryDaysChange: (days: number) => void;
  scenarioFilter: string;
  onScenarioFilterChange: (value: string) => void;
  outcomeFilter: string;
  onOutcomeFilterChange: (value: string) => void;
  onExport: () => void;
}

export function EvalsCenterPanel({
  evals,
  historyDays,
  onHistoryDaysChange,
  scenarioFilter,
  onScenarioFilterChange,
  outcomeFilter,
  onOutcomeFilterChange,
  onExport
}: EvalsCenterPanelProps) {
  const [activeChart, setActiveChart] = useState<'trend' | 'suites' | 'passRate'>('trend');
  const trendHistory = evals.persistedDailyHistory?.length ? evals.persistedDailyHistory : evals.dailyTrend;
  const trendData = useMemo(
    () =>
      trendHistory.map(point => ({
        day: point.day,
        dayLabel: formatDayLabel(point.day),
        runCount: point.runCount,
        passRate: point.passRate
      })),
    [trendHistory]
  );
  const suiteData = useMemo(
    () =>
      (evals.promptRegression?.suites ?? []).map(item => ({
        suiteId: item.suiteId,
        label: item.label,
        promptCount: item.promptCount
      })),
    [evals.promptRegression?.suites]
  );
  const passRateData = useMemo(
    () => [{ key: 'passRate', label: '通过率', value: evals.overallPassRate, fill: 'var(--color-passRate)' }],
    [evals.overallPassRate]
  );

  return (
    <DashboardCenterShell
      title="评测基线"
      description="跟踪 benchmark、prompt regression 与最近命中运行的表现。"
      count={evals.scenarioCount}
      actions={
        <Button size="sm" onClick={onExport}>
          导出
        </Button>
      }
    >
      <DashboardMetricGrid
        columns="md:grid-cols-3"
        items={[
          { label: '场景数', value: evals.scenarioCount, note: '当前 benchmark scenarios 总数' },
          { label: '命中运行数', value: evals.runCount, note: '最近命中 benchmark 的运行数量' },
          { label: '总体通过率', value: `${evals.overallPassRate}%`, note: '按 scenario 聚合后的总体通过率' }
        ]}
      />

      <Card className="border-border/70 bg-card/90 shadow-sm">
        <CardHeader className="gap-4 border-b border-[#ecece8] pb-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <CardTitle className="text-lg font-semibold text-foreground">
                {activeChart === 'trend' ? '每日趋势' : activeChart === 'suites' ? 'Prompt 套件覆盖' : '总体通过率'}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {activeChart === 'trend'
                  ? '跟踪 benchmark 命中量与通过率走势。'
                  : activeChart === 'suites'
                    ? '查看 prompt regression 各 suite 的覆盖规模。'
                    : '快速查看总体 benchmark 通过率。'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {[7, 30, 90].map(option => (
                <Button
                  key={option}
                  type="button"
                  size="sm"
                  variant={historyDays === option ? 'default' : 'secondary'}
                  onClick={() => onHistoryDaysChange(option)}
                >
                  {option}天
                </Button>
              ))}
              <Badge variant="outline">
                当前 {evals.dailyTrend.length} / 持久化 {evals.historyDays ?? trendHistory.length}
              </Badge>
              <Button type="button" size="sm" variant="outline" onClick={onExport}>
                导出
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={activeChart === 'trend' ? 'default' : 'ghost'}
              onClick={() => setActiveChart('trend')}
            >
              趋势
            </Button>
            <Button
              size="sm"
              variant={activeChart === 'suites' ? 'default' : 'ghost'}
              onClick={() => setActiveChart('suites')}
            >
              套件
            </Button>
            <Button
              size="sm"
              variant={activeChart === 'passRate' ? 'default' : 'ghost'}
              onClick={() => setActiveChart('passRate')}
            >
              通过率
            </Button>
          </div>
        </CardHeader>
        {evals.historyRange ? (
          <p className="px-6 text-xs text-muted-foreground">
            归档范围 {evals.historyRange.earliestDay} - {evals.historyRange.latestDay}
          </p>
        ) : null}
        <CardContent className="pt-5">
          {activeChart === 'trend' ? (
            trendData.length ? (
              <ChartContainer config={evalTrendConfig}>
                <AreaChart data={trendData} margin={{ left: 8, right: 8, top: 12, bottom: 4 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="dayLabel" tickLine={false} axisLine={false} />
                  <YAxis yAxisId="runs" tickLine={false} axisLine={false} width={56} />
                  <YAxis yAxisId="passRate" orientation="right" tickLine={false} axisLine={false} width={56} />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        labelFormatter={value => `日期 ${value ?? ''}`}
                        formatter={(value, name) =>
                          name === 'passRate' ? `${Number(value).toFixed(0)}%` : Number(value).toLocaleString()
                        }
                      />
                    }
                  />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Area
                    yAxisId="runs"
                    type="monotone"
                    dataKey="runCount"
                    stroke="var(--color-runCount)"
                    fill="var(--color-runCount)"
                    fillOpacity={0.2}
                    strokeWidth={2}
                  />
                  <Area
                    yAxisId="passRate"
                    type="monotone"
                    dataKey="passRate"
                    stroke="var(--color-passRate)"
                    fill="var(--color-passRate)"
                    fillOpacity={0.12}
                    strokeWidth={2}
                  />
                </AreaChart>
              </ChartContainer>
            ) : (
              <DashboardEmptyState message="当前还没有可用趋势数据。" />
            )
          ) : null}
          {activeChart === 'suites' ? (
            suiteData.length ? (
              <ChartContainer config={evalSuiteConfig}>
                <BarChart data={suiteData} margin={{ left: 8, right: 8, top: 12, bottom: 4 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} width={56} />
                  <ChartTooltip content={<ChartTooltipContent formatter={value => Number(value).toLocaleString()} />} />
                  <Bar dataKey="promptCount" fill="var(--color-promptCount)" radius={[10, 10, 4, 4]} />
                </BarChart>
              </ChartContainer>
            ) : (
              <DashboardEmptyState message="当前还没有 prompt suite 覆盖数据。" />
            )
          ) : null}
          {activeChart === 'passRate' ? (
            passRateData[0].value > 0 ? (
              <ChartContainer config={evalPassRateConfig} className="h-[300px]">
                <PieChart>
                  <ChartTooltip content={<ChartTooltipContent formatter={value => `${Number(value).toFixed(0)}%`} />} />
                  <Pie
                    data={passRateData}
                    dataKey="value"
                    nameKey="key"
                    innerRadius={70}
                    outerRadius={108}
                    paddingAngle={4}
                  >
                    {passRateData.map(item => (
                      <Cell key={item.key} fill={item.fill} />
                    ))}
                  </Pie>
                  <ChartLegend content={<ChartLegendContent />} />
                </PieChart>
              </ChartContainer>
            ) : (
              <DashboardEmptyState message="当前没有总体通过率可视化数据。" />
            )
          ) : null}
        </CardContent>
      </Card>

      <PromptRegressionSection evals={evals} />
      <BenchmarkSections
        evals={evals}
        scenarioFilter={scenarioFilter}
        onScenarioFilterChange={onScenarioFilterChange}
        outcomeFilter={outcomeFilter}
        onOutcomeFilterChange={onOutcomeFilterChange}
      />
    </DashboardCenterShell>
  );
}

const evalTrendConfig = {
  runCount: { label: 'Runs', color: 'var(--chart-1)' },
  passRate: { label: 'Pass Rate', color: 'var(--chart-2)' }
} satisfies ChartConfig;

const evalSuiteConfig = {
  promptCount: { label: 'Prompt Count', color: 'var(--chart-3)' }
} satisfies ChartConfig;

const evalPassRateConfig = {
  passRate: { label: 'Pass Rate', color: 'var(--chart-2)' }
} satisfies ChartConfig;

function formatDayLabel(day: string) {
  const date = new Date(day);
  if (Number.isNaN(date.getTime())) {
    return day;
  }
  return `${date.getMonth() + 1}/${date.getDate()}`;
}
