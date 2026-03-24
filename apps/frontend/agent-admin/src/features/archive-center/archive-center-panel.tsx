import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import type { EvalsCenterRecord, RuntimeCenterRecord } from '../../types/admin';

interface ArchiveCenterPanelProps {
  runtime: RuntimeCenterRecord;
  evals: EvalsCenterRecord;
  runtimeHistoryDays: number;
  evalsHistoryDays: number;
  onRuntimeHistoryDaysChange: (days: number) => void;
  onEvalsHistoryDaysChange: (days: number) => void;
  onExportRuntime: () => void;
  onExportEvals: () => void;
}

export function ArchiveCenterPanel(props: ArchiveCenterPanelProps) {
  const usageHistory = props.runtime.usageAnalytics.persistedDailyHistory ?? [];
  const evalHistory = props.evals.persistedDailyHistory ?? [];
  const recentUsageAudit = props.runtime.usageAnalytics.recentUsageAudit ?? [];
  const recentEvalRuns = props.evals.recentRuns ?? [];

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="rounded-3xl border-stone-200 bg-white shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-semibold text-stone-950">Runtime Archive</CardTitle>
            <button
              type="button"
              onClick={props.onExportRuntime}
              className="rounded-full bg-stone-900 px-3 py-1 text-xs text-white"
            >
              导出 runtime
            </button>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">归档天数 {props.runtime.usageAnalytics.historyDays ?? 0}</Badge>
              {props.runtime.usageAnalytics.historyRange ? (
                <Badge variant="secondary">
                  {props.runtime.usageAnalytics.historyRange.earliestDay} -{' '}
                  {props.runtime.usageAnalytics.historyRange.latestDay}
                </Badge>
              ) : null}
              {[7, 30, 90].map(days => (
                <button
                  key={days}
                  type="button"
                  onClick={() => props.onRuntimeHistoryDaysChange(days)}
                  className={`rounded-full px-3 py-1 text-xs ${
                    props.runtimeHistoryDays === days ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-600'
                  }`}
                >
                  {days}d
                </button>
              ))}
            </div>
            {usageHistory
              .slice(-10)
              .reverse()
              .map(point => (
                <article key={point.day} className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <strong className="text-sm text-stone-950">{point.day}</strong>
                    <Badge variant={point.overBudget ? 'warning' : 'outline'}>
                      {point.tokens.toLocaleString()} tokens
                    </Badge>
                  </div>
                  <p className="mt-2 text-xs text-stone-500">
                    {point.runs} runs · ¥{point.costCny.toFixed(2)} · 实测 {point.measuredRunCount ?? 0} / 估算{' '}
                    {point.estimatedRunCount ?? 0}
                  </p>
                </article>
              ))}
            <div className="grid gap-3 pt-2">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-400">Recent Usage Audit</p>
              {recentUsageAudit.slice(0, 5).map(item => (
                <article
                  key={`${item.taskId}-${item.updatedAt}`}
                  className="rounded-2xl border border-stone-200 px-4 py-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <strong className="text-sm text-stone-950">{item.taskId}</strong>
                    <Badge variant="outline">{item.totalTokens.toLocaleString()} tokens</Badge>
                  </div>
                  <p className="mt-2 text-xs text-stone-500">
                    {item.day} · ¥{item.totalCostCny.toFixed(2)} · 实测 {item.measuredCallCount} / 估算{' '}
                    {item.estimatedCallCount}
                  </p>
                </article>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-stone-200 bg-white shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-semibold text-stone-950">Evals Archive</CardTitle>
            <button
              type="button"
              onClick={props.onExportEvals}
              className="rounded-full bg-stone-900 px-3 py-1 text-xs text-white"
            >
              导出 evals
            </button>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">归档天数 {props.evals.historyDays ?? 0}</Badge>
              {props.evals.historyRange ? (
                <Badge variant="secondary">
                  {props.evals.historyRange.earliestDay} - {props.evals.historyRange.latestDay}
                </Badge>
              ) : null}
              {[7, 30, 90].map(days => (
                <button
                  key={days}
                  type="button"
                  onClick={() => props.onEvalsHistoryDaysChange(days)}
                  className={`rounded-full px-3 py-1 text-xs ${
                    props.evalsHistoryDays === days ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-600'
                  }`}
                >
                  {days}d
                </button>
              ))}
            </div>
            {evalHistory
              .slice(-10)
              .reverse()
              .map(point => (
                <article key={point.day} className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <strong className="text-sm text-stone-950">{point.day}</strong>
                    <Badge
                      variant={point.passRate >= 70 ? 'success' : point.passRate >= 40 ? 'warning' : 'destructive'}
                    >
                      {point.passRate}%
                    </Badge>
                  </div>
                  <p className="mt-2 text-xs text-stone-500">
                    运行 {point.runCount} · 通过 {point.passCount} · 场景 {point.scenarioCount}
                  </p>
                </article>
              ))}
            <div className="grid gap-3 pt-2">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-400">Recent Eval Runs</p>
              {recentEvalRuns.slice(0, 5).map(run => (
                <article
                  key={`${run.taskId}-${run.createdAt}`}
                  className="rounded-2xl border border-stone-200 px-4 py-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <strong className="text-sm text-stone-950">{run.taskId}</strong>
                    <Badge variant={run.success ? 'success' : 'destructive'}>{run.success ? 'pass' : 'fail'}</Badge>
                  </div>
                  <p className="mt-2 text-xs text-stone-500">
                    {run.createdAt} · {run.scenarioIds.join(', ')}
                  </p>
                </article>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
