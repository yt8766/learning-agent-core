import { useMemo, useState, type ChangeEvent } from 'react';
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
import {
  DashboardCenterShell,
  DashboardEmptyState,
  DashboardMetricGrid,
  DashboardToolbar
} from '@/components/dashboard-center-shell';

import type { EvalsCenterRecord } from '@/types/admin';

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
    () => [{ key: 'passRate', label: 'Pass Rate', value: evals.overallPassRate, fill: 'var(--color-passRate)' }],
    [evals.overallPassRate]
  );

  return (
    <DashboardCenterShell
      title="Evals Center"
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
                {activeChart === 'trend'
                  ? 'Daily Trend'
                  : activeChart === 'suites'
                    ? 'Prompt Suite Coverage'
                    : 'Overall Pass Rate'}
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
                  {option}d
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
              Trend
            </Button>
            <Button
              size="sm"
              variant={activeChart === 'suites' ? 'default' : 'ghost'}
              onClick={() => setActiveChart('suites')}
            >
              Suites
            </Button>
            <Button
              size="sm"
              variant={activeChart === 'passRate' ? 'default' : 'ghost'}
              onClick={() => setActiveChart('passRate')}
            >
              Pass Rate
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

      <Card className="border-border/70 bg-card/90 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-semibold text-foreground">Prompt Regressions</CardTitle>
          <Badge variant="outline">{evals.promptRegression?.promptSuiteCount ?? 0}</Badge>
        </CardHeader>
        <CardContent className="grid gap-4">
          {!evals.promptRegression ? (
            <DashboardEmptyState message="当前还没有可用的 prompt 回归配置概览。" />
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">suite {evals.promptRegression.promptSuiteCount}</Badge>
                <Badge variant="secondary">prompt {evals.promptRegression.promptCount}</Badge>
                <Badge variant="secondary">tests {evals.promptRegression.testCount}</Badge>
                <Badge variant="secondary">providers {evals.promptRegression.providerCount}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{evals.promptRegression.configPath}</p>
              {evals.promptRegression.updatedAt ? (
                <p className="text-xs text-muted-foreground">配置更新时间 {evals.promptRegression.updatedAt}</p>
              ) : null}
              {evals.promptRegression.latestRun ? (
                <article className="rounded-2xl border border-border/70 bg-background px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">Latest Prompt Run</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {evals.promptRegression.latestRun.summaryPath}
                      </p>
                    </div>
                    <Badge
                      variant={
                        evals.promptRegression.latestRun.overallStatus === 'pass'
                          ? 'success'
                          : evals.promptRegression.latestRun.overallStatus === 'partial'
                            ? 'warning'
                            : 'destructive'
                      }
                    >
                      {evals.promptRegression.latestRun.overallStatus}
                    </Badge>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge variant="secondary">{evals.promptRegression.latestRun.runAt}</Badge>
                    {typeof evals.promptRegression.latestRun.passRate === 'number' ? (
                      <Badge variant="secondary">pass {evals.promptRegression.latestRun.passRate}%</Badge>
                    ) : null}
                    {evals.promptRegression.latestRun.providerIds.map(providerId => (
                      <span key={providerId}>
                        <Badge variant="secondary">{providerId}</Badge>
                      </span>
                    ))}
                  </div>
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    {evals.promptRegression.latestRun.suiteResults.map(result => (
                      <article
                        key={result.suiteId}
                        className="rounded-2xl border border-border/70 bg-muted/30 px-3 py-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-foreground">{result.label}</p>
                            <p className="mt-1 text-xs text-muted-foreground">{result.suiteId}</p>
                          </div>
                          <Badge
                            variant={
                              result.status === 'pass'
                                ? 'success'
                                : result.status === 'partial'
                                  ? 'warning'
                                  : 'destructive'
                            }
                          >
                            {result.status}
                          </Badge>
                        </div>
                        {typeof result.passRate === 'number' ? (
                          <p className="mt-2 text-xs text-muted-foreground">通过率 {result.passRate}%</p>
                        ) : null}
                        {result.notes?.length ? (
                          <p className="mt-2 text-xs text-muted-foreground">{result.notes.join('；')}</p>
                        ) : null}
                        {result.promptResults.length ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {result.promptResults.map(prompt => (
                              <span key={prompt.promptId}>
                                <Badge
                                  variant={
                                    prompt.pass === true
                                      ? 'success'
                                      : prompt.pass === false
                                        ? 'destructive'
                                        : 'secondary'
                                  }
                                >
                                  {prompt.version}{' '}
                                  {prompt.pass === true ? 'pass' : prompt.pass === false ? 'fail' : 'n/a'}
                                </Badge>
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </article>
                    ))}
                  </div>
                </article>
              ) : (
                <p className="text-xs text-muted-foreground">当前还没有最近一次 prompt 回归结果摘要。</p>
              )}
              <div className="grid gap-3 md:grid-cols-2">
                {evals.promptRegression.suites.map(suite => (
                  <article key={suite.suiteId} className="rounded-2xl border border-border/70 bg-muted/30 px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{suite.label}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{suite.suiteId}</p>
                      </div>
                      <Badge variant="outline">{suite.promptCount}</Badge>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {suite.versions.map(version => (
                        <span key={`${suite.suiteId}-${version}`}>
                          <Badge variant="secondary">{version}</Badge>
                        </span>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card/90 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-semibold text-foreground">Benchmark Scenarios</CardTitle>
          <Badge variant="outline">{evals.scenarios.length}</Badge>
        </CardHeader>
        <CardContent className="grid gap-3">
          <DashboardToolbar title="Benchmark Filters" description="按场景和结果筛选 benchmark 视图。">
            <div className="grid gap-3 md:grid-cols-2">
              <label className="grid gap-1 text-xs text-muted-foreground">
                场景筛选
                <select
                  value={scenarioFilter}
                  onChange={(event: ChangeEvent<HTMLSelectElement>) => onScenarioFilterChange(event.target.value)}
                  className="rounded-2xl border border-input bg-background px-3 py-2 text-sm text-foreground"
                >
                  <option value="">全部</option>
                  {evals.scenarios.map(scenario => (
                    <option key={scenario.scenarioId} value={scenario.scenarioId}>
                      {scenario.scenarioId}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-xs text-muted-foreground">
                结果筛选
                <select
                  value={outcomeFilter}
                  onChange={(event: ChangeEvent<HTMLSelectElement>) => onOutcomeFilterChange(event.target.value)}
                  className="rounded-2xl border border-input bg-background px-3 py-2 text-sm text-foreground"
                >
                  <option value="">全部</option>
                  <option value="pass">pass</option>
                  <option value="fail">fail</option>
                </select>
              </label>
            </div>
          </DashboardToolbar>
          {evals.scenarios.map(scenario => (
            <article key={scenario.scenarioId} className="rounded-2xl border border-border/70 bg-muted/30 px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">{scenario.label}</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">{scenario.description}</p>
                </div>
                <Badge
                  variant={scenario.passRate >= 70 ? 'success' : scenario.passRate >= 40 ? 'warning' : 'destructive'}
                >
                  {scenario.passRate}%
                </Badge>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span>命中 {scenario.matchedRunCount}</span>
                <span>通过 {scenario.passCount}</span>
                <span>失败 {scenario.failCount}</span>
              </div>
            </article>
          ))}
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card/90 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-semibold text-foreground">Recent Benchmark Runs</CardTitle>
          <Badge variant="outline">{evals.recentRuns.length}</Badge>
        </CardHeader>
        <CardContent className="grid gap-3">
          {evals.recentRuns.length === 0 ? (
            <DashboardEmptyState message="当前还没有命中 benchmark 的运行记录。" />
          ) : (
            evals.recentRuns.map(run => (
              <article
                key={`${run.taskId}-${run.createdAt}`}
                className="rounded-2xl border border-border/70 bg-muted/30 px-4 py-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{run.taskId}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{run.createdAt}</p>
                  </div>
                  <Badge variant={run.success ? 'success' : 'destructive'}>{run.success ? 'pass' : 'fail'}</Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {run.scenarioIds.map(scenarioId => (
                    <span key={`${run.taskId}-${scenarioId}`}>
                      <Badge variant="secondary">{scenarioId}</Badge>
                    </span>
                  ))}
                </div>
              </article>
            ))
          )}
        </CardContent>
      </Card>
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
