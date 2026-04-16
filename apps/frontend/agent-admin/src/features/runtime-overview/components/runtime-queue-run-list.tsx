import type { ChangeEvent } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DashboardToolbar } from '@/components/dashboard-center-shell';

import type { RuntimeOverviewPanelProps } from './runtime-overview-types';
import { buildRouteReason, formatRouteConfidence, summarizeExecutionSteps } from './runtime-queue-section-support';

type RuntimeQueueRunListProps = Pick<
  RuntimeOverviewPanelProps,
  | 'runtime'
  | 'statusFilter'
  | 'onStatusFilterChange'
  | 'modelFilter'
  | 'onModelFilterChange'
  | 'pricingSourceFilter'
  | 'onPricingSourceFilterChange'
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
    onExport
  } = props;

  return (
    <Card className="border-border/70 bg-card/90 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg font-semibold text-foreground">Run Queue</CardTitle>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{runtime.recentRuns.length}</Badge>
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
          <div className="grid gap-3 md:grid-cols-3">
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
          </div>
        </DashboardToolbar>

        {runtime.recentRuns.map(task => {
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
                {task.queueState ? <Badge variant="outline">{task.queueState.mode}</Badge> : null}
                {task.queueState ? <Badge variant="outline">attempt {task.queueState.attempt}</Badge> : null}
                {executionSummary ? <Badge variant="secondary">{executionSummary.currentCopy}</Badge> : null}
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
            </article>
          );
        })}
      </CardContent>
    </Card>
  );
}
