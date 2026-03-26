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
          {(runtime.activeWorkerSlots?.length ?? 0) > 0 ? (
            <div className="grid gap-2 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4">
              <p className="text-sm font-semibold text-stone-900">Worker Slots</p>
              {runtime.activeWorkerSlots?.map(slot => (
                <div key={slot.slotId} className="flex items-center justify-between gap-3 text-xs text-stone-600">
                  <span>
                    {slot.slotId} / {slot.taskId}
                  </span>
                  <span>{new Date(slot.startedAt).toLocaleString()}</span>
                </div>
              ))}
            </div>
          ) : null}
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
                {task.resolvedWorkflow ? (
                  <Badge variant="secondary">
                    {task.resolvedWorkflow.id} v{task.resolvedWorkflow.version ?? '1.0.0'}
                  </Badge>
                ) : null}
                {task.currentMinistry ? <Badge variant="secondary">{task.currentMinistry}</Badge> : null}
                {task.currentWorker ? <Badge variant="secondary">{task.currentWorker}</Badge> : null}
                {task.currentStep ? <Badge variant="secondary">{task.currentStep}</Badge> : null}
                {task.queueState ? <Badge variant="outline">{task.queueState.mode}</Badge> : null}
                {task.queueState ? <Badge variant="outline">attempt {task.queueState.attempt}</Badge> : null}
                {task.subgraphTrail?.map(subgraph => (
                  <span key={`${task.id}-${subgraph}`}>
                    <Badge variant="outline">{subgraph}</Badge>
                  </span>
                ))}
              </div>
              {task.queueState ? (
                <div className="mt-3 grid gap-1 text-xs text-stone-500">
                  <p>
                    queue {task.queueState.status} / enqueued {new Date(task.queueState.enqueuedAt).toLocaleString()}
                  </p>
                  {task.queueState.leaseOwner ? <p>lease {task.queueState.leaseOwner}</p> : null}
                  {task.queueState.lastHeartbeatAt ? (
                    <p>heartbeat {new Date(task.queueState.lastHeartbeatAt).toLocaleString()}</p>
                  ) : null}
                </div>
              ) : null}
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
                {bundle.task.resolvedWorkflow ? (
                  <Badge variant="secondary">
                    {bundle.task.resolvedWorkflow.id} v{bundle.task.resolvedWorkflow.version ?? '1.0.0'}
                  </Badge>
                ) : null}
                {bundle.task.currentNode ? <Badge variant="secondary">{bundle.task.currentNode}</Badge> : null}
                {bundle.task.currentMinistry ? <Badge variant="secondary">{bundle.task.currentMinistry}</Badge> : null}
                {bundle.task.currentWorker ? <Badge variant="secondary">{bundle.task.currentWorker}</Badge> : null}
                {bundle.task.queueState ? <Badge variant="outline">{bundle.task.queueState.mode}</Badge> : null}
                {bundle.task.queueState ? (
                  <Badge variant="outline">attempt {bundle.task.queueState.attempt}</Badge>
                ) : null}
                {bundle.task.subgraphTrail?.map(subgraph => (
                  <span key={`${bundle.task.id}-${subgraph}`}>
                    <Badge variant="outline">{subgraph}</Badge>
                  </span>
                ))}
              </div>
              {bundle.task.queueState ? (
                <div className="grid gap-1 rounded-2xl border border-stone-200 bg-stone-50 px-3 py-3 text-xs text-stone-600">
                  <p>Queue: {bundle.task.queueState.status}</p>
                  <p>Enqueued: {new Date(bundle.task.queueState.enqueuedAt).toLocaleString()}</p>
                  {bundle.task.queueState.startedAt ? (
                    <p>Started: {new Date(bundle.task.queueState.startedAt).toLocaleString()}</p>
                  ) : null}
                  {bundle.task.queueState.leaseOwner ? <p>Lease Owner: {bundle.task.queueState.leaseOwner}</p> : null}
                  {bundle.task.queueState.lastHeartbeatAt ? (
                    <p>Last Heartbeat: {new Date(bundle.task.queueState.lastHeartbeatAt).toLocaleString()}</p>
                  ) : null}
                  {bundle.task.queueState.leaseExpiresAt ? (
                    <p>Lease Expires: {new Date(bundle.task.queueState.leaseExpiresAt).toLocaleString()}</p>
                  ) : null}
                  {bundle.task.queueState.finishedAt ? (
                    <p>Finished: {new Date(bundle.task.queueState.finishedAt).toLocaleString()}</p>
                  ) : null}
                </div>
              ) : null}
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
              {bundle.audit ? (
                <div className="grid gap-2">
                  <p className="text-sm font-semibold text-stone-900">Audit Replay</p>
                  {bundle.audit.entries.slice(0, 6).map(entry => (
                    <article key={entry.id} className="rounded-2xl border border-stone-200 bg-stone-50 px-3 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <strong className="text-sm text-stone-900">
                          {entry.type} / {entry.title}
                        </strong>
                        <span className="text-xs text-stone-500">{entry.at}</span>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-stone-700">{entry.summary}</p>
                    </article>
                  ))}
                  {bundle.audit.browserReplays.length ? (
                    <div className="rounded-2xl border border-stone-200 bg-stone-50 px-3 py-3 text-xs text-stone-600">
                      <p className="font-semibold text-stone-900">Browser Replays</p>
                      <div className="mt-2 grid gap-1">
                        {bundle.audit.browserReplays.map((replay, index) => (
                          <p key={`${replay.sessionId ?? 'replay'}-${index}`}>
                            {replay.sessionId ?? 'unknown'} / {replay.url ?? 'n/a'} / steps {replay.stepCount}
                          </p>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-stone-500">当前没有选中的运行任务。</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
