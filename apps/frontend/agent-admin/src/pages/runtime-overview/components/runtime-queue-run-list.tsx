import { useEffect, useState, type ChangeEvent } from 'react';

import type { RunBundleRecord } from '@agent/core';

import { getRunObservatory, isAbortedAdminRequestError } from '@/api/admin-api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DashboardToolbar } from '@/components/dashboard-center-shell';

import type { RuntimeOverviewPanelProps } from './runtime-overview-types';
import { buildRouteReason, formatRouteConfidence, summarizeExecutionSteps } from './runtime-queue-section-support';
import {
  buildFallbackRunsFromRuntime,
  filterObservabilityRunsWithRuntimeTasks,
  type RuntimeQueueRunFilters
} from './runtime-queue-run-list-support';

type RuntimeQueueRunListProps = Pick<
  RuntimeOverviewPanelProps,
  | 'runtime'
  | 'statusFilter'
  | 'onStatusFilterChange'
  | 'modelFilter'
  | 'onModelFilterChange'
  | 'pricingSourceFilter'
  | 'onPricingSourceFilterChange'
  | 'executionModeFilter'
  | 'onExecutionModeFilterChange'
  | 'interactionKindFilter'
  | 'onInteractionKindFilterChange'
  | 'onSelectTask'
  | 'onExport'
>;

export function RuntimeQueueRunList(props: RuntimeQueueRunListProps) {
  const {
    runtime,
    statusFilter,
    onStatusFilterChange,
    modelFilter,
    onModelFilterChange,
    pricingSourceFilter,
    onPricingSourceFilterChange,
    executionModeFilter,
    onExecutionModeFilterChange,
    interactionKindFilter,
    onInteractionKindFilterChange,
    onSelectTask,
    onExport
  } = props;
  const [observabilityRuns, setObservabilityRuns] = useState<RunBundleRecord['run'][]>([]);
  const [observabilityError, setObservabilityError] = useState('');
  const [observabilityLoaded, setObservabilityLoaded] = useState(false);

  const filters: RuntimeQueueRunFilters = {
    statusFilter,
    modelFilter,
    pricingSourceFilter,
    executionModeFilter,
    interactionKindFilter
  };

  useEffect(() => {
    let cancelled = false;
    void getRunObservatory({
      status: statusFilter || undefined,
      model: modelFilter || undefined,
      pricingSource: pricingSourceFilter || undefined,
      executionMode: executionModeFilter === 'all' ? undefined : executionModeFilter,
      interactionKind: interactionKindFilter === 'all' ? undefined : interactionKindFilter,
      limit: 100
    })
      .then(items => {
        if (!cancelled) {
          setObservabilityRuns(items);
          setObservabilityError('');
          setObservabilityLoaded(true);
        }
      })
      .catch(error => {
        if (!cancelled && !isAbortedAdminRequestError(error)) {
          setObservabilityRuns([]);
          setObservabilityError(error instanceof Error ? error.message : '加载 observability list 失败。');
          setObservabilityLoaded(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [statusFilter, modelFilter, pricingSourceFilter, executionModeFilter, interactionKindFilter]);

  const runs =
    observabilityLoaded && !observabilityError
      ? filterObservabilityRunsWithRuntimeTasks(observabilityRuns, runtime, filters)
      : buildFallbackRunsFromRuntime(runtime, filters);

  return (
    <Card className="border-border/70 bg-card/90 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg font-semibold text-foreground">Run Queue</CardTitle>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{runs.length}</Badge>
          <Button type="button" size="sm" onClick={onExport}>
            导出
          </Button>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3">
        {(runtime.activeWorkerSlots?.length ?? 0) > 0 ? (
          <div className="grid gap-2 rounded-2xl border border-border/70 bg-muted/30 px-4 py-4">
            <p className="text-sm font-semibold text-foreground">Worker Slots</p>
            {runtime.activeWorkerSlots?.map(slot => (
              <div key={slot.slotId} className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                <span>
                  {slot.slotId} / {slot.taskId}
                </span>
                <span>{new Date(slot.startedAt).toLocaleString()}</span>
              </div>
            ))}
          </div>
        ) : null}
        <DashboardToolbar title="Queue Filters" description="保留现有筛选逻辑，只统一成 dashboard 工具栏样式。">
          <div className="grid gap-3 xl:grid-cols-5">
            <label className="grid gap-1 text-xs text-muted-foreground">
              状态筛选
              <select
                value={statusFilter}
                onChange={(event: ChangeEvent<HTMLSelectElement>) => onStatusFilterChange(event.target.value)}
                className="rounded-2xl border border-input bg-background px-3 py-2 text-sm text-foreground"
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
            <label className="grid gap-1 text-xs text-muted-foreground">
              模型筛选
              <select
                value={modelFilter}
                onChange={(event: ChangeEvent<HTMLSelectElement>) => onModelFilterChange(event.target.value)}
                className="rounded-2xl border border-input bg-background px-3 py-2 text-sm text-foreground"
              >
                <option value="">全部</option>
                {runtime.usageAnalytics.models.map(model => (
                  <option key={model.model} value={model.model}>
                    {model.model}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-xs text-muted-foreground">
              计费来源
              <select
                value={pricingSourceFilter}
                onChange={(event: ChangeEvent<HTMLSelectElement>) => onPricingSourceFilterChange(event.target.value)}
                className="rounded-2xl border border-input bg-background px-3 py-2 text-sm text-foreground"
              >
                <option value="">全部</option>
                <option value="provider">provider</option>
                <option value="estimated">estimated</option>
              </select>
            </label>
            <label className="grid gap-1 text-xs text-muted-foreground">
              执行模式
              <select
                value={executionModeFilter}
                onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                  onExecutionModeFilterChange(event.target.value as RuntimeQueueRunFilters['executionModeFilter'])
                }
                className="rounded-2xl border border-input bg-background px-3 py-2 text-sm text-foreground"
              >
                <option value="all">全部</option>
                <option value="plan">plan</option>
                <option value="execute">execute</option>
                <option value="imperial_direct">imperial_direct</option>
              </select>
            </label>
            <label className="grid gap-1 text-xs text-muted-foreground">
              中断类型
              <select
                value={interactionKindFilter}
                onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                  onInteractionKindFilterChange(event.target.value as RuntimeQueueRunFilters['interactionKindFilter'])
                }
                className="rounded-2xl border border-input bg-background px-3 py-2 text-sm text-foreground"
              >
                <option value="all">全部</option>
                <option value="approval">approval</option>
                <option value="plan-question">plan-question</option>
                <option value="supplemental-input">supplemental-input</option>
                <option value="revise-required">revise-required</option>
                <option value="micro-loop-exhausted">micro-loop-exhausted</option>
                <option value="mode-transition">mode-transition</option>
              </select>
            </label>
          </div>
        </DashboardToolbar>
        {observabilityError ? <p className="text-xs text-muted-foreground">{observabilityError}</p> : null}

        {runs.map(run => {
          const task = runtime.recentRuns.find(item => item.id === run.taskId);
          if (!task) {
            return (
              <article key={run.taskId} className="rounded-2xl border border-border/70 bg-muted/30 px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{run.goal}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{run.taskId}</p>
                  </div>
                  <Badge variant="outline">{run.status}</Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {run.currentStage ? <Badge variant="secondary">{run.currentStage}</Badge> : null}
                  {run.hasInterrupt ? <Badge variant="outline">interrupt</Badge> : null}
                  {run.hasFallback ? <Badge variant="outline">fallback</Badge> : null}
                  {run.hasRecoverableCheckpoint ? <Badge variant="outline">recoverable</Badge> : null}
                </div>
                <div className="mt-3">
                  <Button type="button" size="sm" onClick={() => void onSelectTask(run.taskId)}>
                    查看观测详情
                  </Button>
                </div>
              </article>
            );
          }

          const executionSummary = summarizeExecutionSteps(task);
          return (
            <article key={task.id} className="rounded-2xl border border-border/70 bg-muted/30 px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">{task.goal}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{task.id}</p>
                </div>
                <Badge variant="outline">{task.status}</Badge>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {task.resolvedWorkflow ? (
                  <Badge variant="secondary">
                    {task.resolvedWorkflow.id} v{task.resolvedWorkflow.version ?? '1.0.0'}
                  </Badge>
                ) : null}
                {task.specialistLead ? (
                  <Badge variant="secondary">主导: {task.specialistLead.displayName}</Badge>
                ) : null}
                {task.supportingSpecialists?.length ? (
                  <Badge variant="outline">支撑 {task.supportingSpecialists.length}</Badge>
                ) : null}
                {formatRouteConfidence(task.routeConfidence) ? (
                  <Badge variant="outline">{formatRouteConfidence(task.routeConfidence)}</Badge>
                ) : null}
                {task.critiqueResult ? <Badge variant="outline">刑部 {task.critiqueResult.decision}</Badge> : null}
                {task.currentMinistry ? <Badge variant="secondary">{task.currentMinistry}</Badge> : null}
                {task.currentWorker ? <Badge variant="secondary">{task.currentWorker}</Badge> : null}
                {task.currentStep ? <Badge variant="secondary">{task.currentStep}</Badge> : null}
                {run.currentStage ? <Badge variant="secondary">{run.currentStage}</Badge> : null}
                {task.queueState ? <Badge variant="outline">{task.queueState.mode}</Badge> : null}
                {task.queueState ? <Badge variant="outline">attempt {task.queueState.attempt}</Badge> : null}
                {executionSummary ? <Badge variant="secondary">{executionSummary.currentCopy}</Badge> : null}
                {run.hasInterrupt ? <Badge variant="outline">interrupt</Badge> : null}
                {run.hasFallback ? <Badge variant="outline">fallback</Badge> : null}
                {run.hasRecoverableCheckpoint ? <Badge variant="outline">recoverable</Badge> : null}
                {run.diagnosticFlags.slice(0, 2).map(flag => (
                  <span key={`${task.id}-${flag}`}>
                    <Badge variant="outline">{flag}</Badge>
                  </span>
                ))}
                {task.subgraphTrail?.map((subgraph: string) => (
                  <span key={`${task.id}-${subgraph}`}>
                    <Badge variant="outline">{subgraph}</Badge>
                  </span>
                ))}
              </div>
              {task.queueState ? (
                <div className="mt-3 grid gap-1 text-xs text-muted-foreground">
                  <p>
                    queue {task.queueState.status} / enqueued {new Date(task.queueState.enqueuedAt).toLocaleString()}
                  </p>
                  {executionSummary ? (
                    <p>
                      execution steps / blocked {executionSummary.blockedCount} / recovery{' '}
                      {executionSummary.recoveryCount}
                    </p>
                  ) : null}
                  {executionSummary?.lastReason ? <p>last reason: {executionSummary.lastReason}</p> : null}
                  {buildRouteReason(task) ? <p>{buildRouteReason(task)}</p> : null}
                  {task.queueState.leaseOwner ? <p>lease {task.queueState.leaseOwner}</p> : null}
                  {task.queueState.lastHeartbeatAt ? (
                    <p>heartbeat {new Date(task.queueState.lastHeartbeatAt).toLocaleString()}</p>
                  ) : null}
                </div>
              ) : null}
              <div className="mt-3">
                <Button type="button" size="sm" onClick={() => void onSelectTask(task.id)}>
                  查看观测详情
                </Button>
              </div>
            </article>
          );
        })}
      </CardContent>
    </Card>
  );
}
