import type { ChangeEvent } from 'react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import type { EvalsCenterRecord } from '../../types/admin';

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
  const trendHistory = evals.persistedDailyHistory?.length ? evals.persistedDailyHistory : evals.dailyTrend;

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 md:grid-cols-3">
        {[
          { label: '场景数', value: evals.scenarioCount },
          { label: '命中运行数', value: evals.runCount },
          { label: '总体通过率', value: `${evals.overallPassRate}%` }
        ].map(card => (
          <Card key={card.label} className="rounded-3xl border-stone-200 bg-white shadow-sm">
            <CardContent className="p-6">
              <p className="text-sm text-stone-500">{card.label}</p>
              <p className="mt-4 text-4xl font-semibold tracking-tight text-stone-950">{card.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="rounded-3xl border-stone-200 bg-white shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-semibold text-stone-950">Daily Trend</CardTitle>
          <div className="flex items-center gap-2">
            {[7, 30, 90].map(option => (
              <button
                key={option}
                type="button"
                onClick={() => onHistoryDaysChange(option)}
                className={`rounded-full px-3 py-1 text-xs ${historyDays === option ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-600'}`}
              >
                {option}d
              </button>
            ))}
            <Badge variant="outline">
              当前 {evals.dailyTrend.length} / 持久化 {evals.historyDays ?? trendHistory.length}
            </Badge>
            <button type="button" onClick={onExport} className="rounded-full bg-stone-900 px-3 py-1 text-xs text-white">
              导出
            </button>
          </div>
        </CardHeader>
        {evals.historyRange ? (
          <p className="px-6 text-xs text-stone-500">
            归档范围 {evals.historyRange.earliestDay} - {evals.historyRange.latestDay}
          </p>
        ) : null}
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {trendHistory.length === 0 ? (
            <p className="text-sm text-stone-500">当前还没有可用趋势数据。</p>
          ) : (
            trendHistory.map(point => (
              <article key={point.day} className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4">
                <p className="text-sm font-semibold text-stone-950">{point.day}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge variant="secondary">运行 {point.runCount}</Badge>
                  <Badge variant="secondary">通过 {point.passCount}</Badge>
                  <Badge variant={point.passRate >= 70 ? 'success' : point.passRate >= 40 ? 'warning' : 'destructive'}>
                    {point.passRate}%
                  </Badge>
                </div>
              </article>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="rounded-3xl border-stone-200 bg-white shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-semibold text-stone-950">Benchmark Scenarios</CardTitle>
          <Badge variant="outline">{evals.scenarios.length}</Badge>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-1 text-xs text-stone-500">
              场景筛选
              <select
                value={scenarioFilter}
                onChange={(event: ChangeEvent<HTMLSelectElement>) => onScenarioFilterChange(event.target.value)}
                className="rounded-2xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900"
              >
                <option value="">全部</option>
                {evals.scenarios.map(scenario => (
                  <option key={scenario.scenarioId} value={scenario.scenarioId}>
                    {scenario.scenarioId}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-xs text-stone-500">
              结果筛选
              <select
                value={outcomeFilter}
                onChange={(event: ChangeEvent<HTMLSelectElement>) => onOutcomeFilterChange(event.target.value)}
                className="rounded-2xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900"
              >
                <option value="">全部</option>
                <option value="pass">pass</option>
                <option value="fail">fail</option>
              </select>
            </label>
          </div>
          {evals.scenarios.map(scenario => (
            <article key={scenario.scenarioId} className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-stone-950">{scenario.label}</p>
                  <p className="mt-1 text-sm leading-6 text-stone-500">{scenario.description}</p>
                </div>
                <Badge
                  variant={scenario.passRate >= 70 ? 'success' : scenario.passRate >= 40 ? 'warning' : 'destructive'}
                >
                  {scenario.passRate}%
                </Badge>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-stone-500">
                <span>命中 {scenario.matchedRunCount}</span>
                <span>通过 {scenario.passCount}</span>
                <span>失败 {scenario.failCount}</span>
              </div>
            </article>
          ))}
        </CardContent>
      </Card>

      <Card className="rounded-3xl border-stone-200 bg-white shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-semibold text-stone-950">Recent Benchmark Runs</CardTitle>
          <Badge variant="outline">{evals.recentRuns.length}</Badge>
        </CardHeader>
        <CardContent className="grid gap-3">
          {evals.recentRuns.length === 0 ? (
            <p className="text-sm text-stone-500">当前还没有命中 benchmark 的运行记录。</p>
          ) : (
            evals.recentRuns.map(run => (
              <article
                key={`${run.taskId}-${run.createdAt}`}
                className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-stone-950">{run.taskId}</p>
                    <p className="mt-1 text-xs text-stone-500">{run.createdAt}</p>
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
    </div>
  );
}
