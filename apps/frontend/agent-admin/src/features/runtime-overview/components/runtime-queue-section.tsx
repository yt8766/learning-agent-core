import type { ChangeEvent } from 'react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import type { RuntimeOverviewPanelProps } from './runtime-overview-types';

export function RuntimeQueueSection(props: RuntimeOverviewPanelProps) {
  const {
    runtime,
    bundle,
    statusFilter,
    onStatusFilterChange,
    modelFilter,
    onModelFilterChange,
    pricingSourceFilter,
    onPricingSourceFilterChange,
    onExport
  } = props;

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.9fr)]">
      <Card className="rounded-3xl border-stone-200 bg-white shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-semibold text-stone-950">Run Queue</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{runtime.recentRuns.length}</Badge>
            <button type="button" onClick={onExport} className="rounded-full bg-stone-900 px-3 py-1 text-xs text-white">
              导出
            </button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="grid gap-3 md:grid-cols-3">
            <label className="grid gap-1 text-xs text-stone-500">
              状态筛选
              <select
                value={statusFilter}
                onChange={(event: ChangeEvent<HTMLSelectElement>) => onStatusFilterChange(event.target.value)}
                className="rounded-2xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900"
              >
                <option value="">全部</option>
                <option value="queued">queued</option>
                <option value="running">running</option>
                <option value="waiting_approval">waiting_approval</option>
                <option value="blocked">blocked</option>
                <option value="completed">completed</option>
                <option value="failed">failed</option>
              </select>
            </label>
            <label className="grid gap-1 text-xs text-stone-500">
              模型筛选
              <select
                value={modelFilter}
                onChange={(event: ChangeEvent<HTMLSelectElement>) => onModelFilterChange(event.target.value)}
                className="rounded-2xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900"
              >
                <option value="">全部</option>
                {runtime.usageAnalytics.models.map(model => (
                  <option key={model.model} value={model.model}>
                    {model.model}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-xs text-stone-500">
              计费来源
              <select
                value={pricingSourceFilter}
                onChange={(event: ChangeEvent<HTMLSelectElement>) => onPricingSourceFilterChange(event.target.value)}
                className="rounded-2xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900"
              >
                <option value="">全部</option>
                <option value="provider">provider</option>
                <option value="estimated">estimated</option>
              </select>
            </label>
          </div>

          {runtime.recentRuns.map(task => (
            <article key={task.id} className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-stone-950">{task.goal}</p>
                  <p className="mt-1 text-xs text-stone-500">{task.id}</p>
                </div>
                <Badge variant="outline">{task.status}</Badge>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {task.currentMinistry ? <Badge variant="secondary">{task.currentMinistry}</Badge> : null}
                {task.currentWorker ? <Badge variant="secondary">{task.currentWorker}</Badge> : null}
                {task.currentStep ? <Badge variant="secondary">{task.currentStep}</Badge> : null}
              </div>
            </article>
          ))}
        </CardContent>
      </Card>

      <Card className="rounded-3xl border-stone-200 bg-white shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-semibold text-stone-950">Selected Run</CardTitle>
          <Badge variant="outline">{bundle?.task.status ?? 'idle'}</Badge>
        </CardHeader>
        <CardContent className="grid gap-4">
          {bundle ? (
            <>
              <div>
                <p className="text-sm font-medium text-stone-950">{bundle.task.goal}</p>
                <p className="mt-1 text-xs text-stone-500">{bundle.task.id}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {bundle.task.currentNode ? <Badge variant="secondary">{bundle.task.currentNode}</Badge> : null}
                {bundle.task.currentMinistry ? <Badge variant="secondary">{bundle.task.currentMinistry}</Badge> : null}
                {bundle.task.currentWorker ? <Badge variant="secondary">{bundle.task.currentWorker}</Badge> : null}
              </div>
              {bundle.task.budgetState ? (
                <div className="grid gap-2 rounded-2xl border border-stone-200 bg-stone-50 px-3 py-3">
                  <p className="text-sm font-semibold text-stone-900">Budget</p>
                  <div className="grid gap-1 text-xs text-stone-600">
                    <p>
                      Step: {bundle.task.budgetState.stepsConsumed}/{bundle.task.budgetState.stepBudget}
                    </p>
                    <p>
                      Retry: {bundle.task.budgetState.retriesConsumed}/{bundle.task.budgetState.retryBudget}
                    </p>
                    <p>
                      Source: {bundle.task.budgetState.sourcesConsumed}/{bundle.task.budgetState.sourceBudget}
                    </p>
                  </div>
                </div>
              ) : null}
              <div className="grid gap-2">
                <p className="text-sm font-semibold text-stone-900">Latest Traces</p>
                {bundle.traces
                  .slice(-4)
                  .reverse()
                  .map((trace, index) => (
                    <article
                      key={`${trace.node}-${trace.at}-${index}`}
                      className="rounded-2xl border border-stone-200 bg-stone-50 px-3 py-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <strong className="text-sm text-stone-900">{trace.node}</strong>
                        <span className="text-xs text-stone-500">{trace.at}</span>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-stone-600">{trace.summary}</p>
                    </article>
                  ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-stone-500">当前没有选中的运行任务。</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
