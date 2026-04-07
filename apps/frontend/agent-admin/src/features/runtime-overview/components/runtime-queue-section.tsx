import type { ChangeEvent } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DashboardToolbar } from '@/components/dashboard-center-shell';

import type { RuntimeOverviewPanelProps } from './runtime-overview-types';
import type { TaskRecord, TraceRecord } from '@/types/admin/tasking';
import { getExecutionModeDisplayName, normalizeExecutionMode } from '@/lib/runtime-semantics';

function formatRouteConfidence(confidence?: number) {
  if (typeof confidence !== 'number') {
    return null;
  }
  if (confidence >= 0.8) {
    return `置信 ${Math.round(confidence * 100)}% / high`;
  }
  if (confidence >= 0.5) {
    return `置信 ${Math.round(confidence * 100)}% / medium`;
  }
  return `置信 ${Math.round(confidence * 100)}% / fallback`;
}

function buildRouteReason(task?: TaskRecord | null) {
  if (!task?.specialistLead) {
    return null;
  }
  if (task.specialistLead.domain === 'general-assistant') {
    return task.specialistLead.reason ? `通用助理兜底：${task.specialistLead.reason}` : '通用助理兜底';
  }
  return task.specialistLead.reason ?? null;
}

function getExecutionStepOwnerLabel(owner?: string) {
  switch (owner) {
    case 'session':
      return '会话层';
    case 'libu':
      return '吏部';
    case 'hubu':
      return '户部';
    case 'gongbu':
      return '工部';
    case 'bingbu':
      return '兵部';
    case 'xingbu':
      return '刑部';
    case 'libu-docs':
      return '礼部';
    case 'system':
      return '系统';
    default:
      return owner ?? '--';
  }
}

function summarizeExecutionSteps(task?: TaskRecord | null) {
  if (!task?.executionSteps?.length) {
    return null;
  }
  const blockedCount = task.executionSteps.filter(step => step.status === 'blocked').length;
  const recoveryCount = task.executionSteps.filter(step => step.stage === 'recovery').length;
  const current = task.currentExecutionStep;
  const currentCopy = current ? `${current.label} / ${getExecutionStepOwnerLabel(current.owner)}` : '未进入阶段';
  const lastReason = [...task.executionSteps].reverse().find(step => step.reason)?.reason;
  return {
    currentCopy,
    blockedCount,
    recoveryCount,
    lastReason: current?.reason ?? lastReason
  };
}

function getTraceNodeLabel(node: string) {
  switch (node) {
    case 'planning_readonly_guard':
      return '计划只读保护';
    default:
      return node;
  }
}

function getTraceSummaryCopy(trace: Pick<TraceRecord, 'node' | 'summary'>) {
  if (trace.node === 'planning_readonly_guard') {
    return '计划只读保护已启用，当前主动跳过 open-web、浏览器、终端与写入路径。';
  }
  return trace.summary;
}

function getAuditEntryTitle(entry: { type: string; title: string; summary: string }) {
  if (entry.title === 'planning_readonly_guard') {
    return `${entry.type} / 计划只读保护`;
  }
  return `${entry.type} / ${entry.title}`;
}

function getAuditEntrySummary(entry: { title: string; summary: string }) {
  if (entry.title === 'planning_readonly_guard') {
    return '计划只读保护已启用，当前主动跳过 open-web、浏览器、终端与写入路径。';
  }
  return entry.summary;
}

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
                <div
                  key={slot.slotId}
                  className="flex items-center justify-between gap-3 text-xs text-muted-foreground"
                >
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
                  {task.subgraphTrail?.map(subgraph => (
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

      <Card className="border-border/70 bg-card/90 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-semibold text-foreground">Selected Run</CardTitle>
          <Badge variant="outline">{bundle?.task.status ?? 'idle'}</Badge>
        </CardHeader>
        <CardContent className="grid gap-4">
          {bundle ? (
            <>
              {(() => {
                const executionSummary = summarizeExecutionSteps(bundle.task);
                return (
                  <>
                    <div>
                      <p className="text-sm font-medium text-foreground">{bundle.task.goal}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{bundle.task.id}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {bundle.task.resolvedWorkflow ? (
                        <Badge variant="secondary">
                          {bundle.task.resolvedWorkflow.id} v{bundle.task.resolvedWorkflow.version ?? '1.0.0'}
                        </Badge>
                      ) : null}
                      {bundle.task.specialistLead ? (
                        <Badge variant="secondary">主导: {bundle.task.specialistLead.displayName}</Badge>
                      ) : null}
                      {bundle.task.supportingSpecialists?.length ? (
                        <Badge variant="outline">支撑 {bundle.task.supportingSpecialists.length}</Badge>
                      ) : null}
                      {formatRouteConfidence(bundle.task.routeConfidence) ? (
                        <Badge variant="outline">{formatRouteConfidence(bundle.task.routeConfidence)}</Badge>
                      ) : null}
                      {bundle.task.critiqueResult ? (
                        <Badge variant="outline">刑部 {bundle.task.critiqueResult.decision}</Badge>
                      ) : null}
                      {bundle.task.currentNode ? <Badge variant="secondary">{bundle.task.currentNode}</Badge> : null}
                      {bundle.task.currentMinistry ? (
                        <Badge variant="secondary">{bundle.task.currentMinistry}</Badge>
                      ) : null}
                      {bundle.task.currentWorker ? (
                        <Badge variant="secondary">{bundle.task.currentWorker}</Badge>
                      ) : null}
                      {bundle.task.executionMode ? <Badge variant="outline">{bundle.task.executionMode}</Badge> : null}
                      {bundle.task.queueState ? <Badge variant="outline">{bundle.task.queueState.mode}</Badge> : null}
                      {bundle.task.queueState ? (
                        <Badge variant="outline">attempt {bundle.task.queueState.attempt}</Badge>
                      ) : null}
                      {executionSummary ? <Badge variant="secondary">{executionSummary.currentCopy}</Badge> : null}
                      {bundle.task.subgraphTrail?.map(subgraph => (
                        <span key={`${bundle.task.id}-${subgraph}`}>
                          <Badge variant="outline">{subgraph}</Badge>
                        </span>
                      ))}
                    </div>
                    {bundle.task.queueState ? (
                      <div className="grid gap-1 rounded-2xl border border-border/70 bg-muted/30 px-3 py-3 text-xs text-muted-foreground">
                        <p>Queue: {bundle.task.queueState.status}</p>
                        <p>Enqueued: {new Date(bundle.task.queueState.enqueuedAt).toLocaleString()}</p>
                        {bundle.task.queueState.startedAt ? (
                          <p>Started: {new Date(bundle.task.queueState.startedAt).toLocaleString()}</p>
                        ) : null}
                        {executionSummary ? (
                          <p>
                            Execution Steps: blocked {executionSummary.blockedCount} / recovery{' '}
                            {executionSummary.recoveryCount}
                          </p>
                        ) : null}
                        {executionSummary?.lastReason ? <p>Last Reason: {executionSummary.lastReason}</p> : null}
                        {bundle.task.queueState.leaseOwner ? (
                          <p>Lease Owner: {bundle.task.queueState.leaseOwner}</p>
                        ) : null}
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
                  </>
                );
              })()}
              {bundle.task.budgetState ? (
                <div className="grid gap-2 rounded-2xl border border-border/70 bg-muted/30 px-3 py-3">
                  <p className="text-sm font-semibold text-foreground">Budget</p>
                  <div className="grid gap-1 text-xs text-muted-foreground">
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
              {bundle.task.specialistLead ? (
                <div className="grid gap-2 rounded-2xl border border-border/70 bg-muted/30 px-3 py-3">
                  <p className="text-sm font-semibold text-foreground">Specialist Routing</p>
                  <div className="grid gap-1 text-xs text-muted-foreground">
                    <p>Lead: {bundle.task.specialistLead.displayName}</p>
                    <p>Domain: {bundle.task.specialistLead.domain}</p>
                    {bundle.task.specialistLead.reason ? <p>Reason: {bundle.task.specialistLead.reason}</p> : null}
                    {bundle.task.supportingSpecialists?.length ? (
                      <p>Supports: {bundle.task.supportingSpecialists.map(item => item.displayName).join(' / ')}</p>
                    ) : null}
                    {formatRouteConfidence(bundle.task.routeConfidence) ? (
                      <p>{formatRouteConfidence(bundle.task.routeConfidence)}</p>
                    ) : null}
                    {buildRouteReason(bundle.task) ? <p>Reason: {buildRouteReason(bundle.task)}</p> : null}
                  </div>
                </div>
              ) : null}
              {bundle.task.planDraft ? (
                <div className="grid gap-2 rounded-2xl border border-border/70 bg-muted/30 px-3 py-3">
                  <p className="text-sm font-semibold text-foreground">Planning Decisions</p>
                  <div className="grid gap-1 text-xs text-muted-foreground">
                    {bundle.task.planMode ? <p>Mode: {bundle.task.planMode}</p> : null}
                    {bundle.task.executionMode ? (
                      <p>
                        Execution Mode:{' '}
                        {getExecutionModeDisplayName(bundle.task.executionMode) ?? bundle.task.executionMode}
                      </p>
                    ) : null}
                    {bundle.task.planDraft.questionSet?.title ? (
                      <p>Question Set: {bundle.task.planDraft.questionSet.title}</p>
                    ) : null}
                    <p>{bundle.task.planDraft.summary}</p>
                    {normalizeExecutionMode(bundle.task.executionMode) === 'plan' ? (
                      <p>
                        Guardrails: plan mode disables open-web / browser / terminal / write tools until planning is
                        finalized.
                      </p>
                    ) : null}
                    {bundle.task.planDraft.autoResolved?.length ? (
                      <p>Auto Resolved: {bundle.task.planDraft.autoResolved.join(' / ')}</p>
                    ) : null}
                    {bundle.task.planDraft.openQuestions?.length ? (
                      <p>Open Questions: {bundle.task.planDraft.openQuestions.join(' / ')}</p>
                    ) : null}
                    {bundle.task.planDraft.assumptions?.length ? (
                      <p>Assumptions: {bundle.task.planDraft.assumptions.join(' / ')}</p>
                    ) : null}
                    {bundle.task.planDraft.microBudget ? (
                      <p>
                        Micro Budget: readonly {bundle.task.planDraft.microBudget.readOnlyToolsUsed}/
                        {bundle.task.planDraft.microBudget.readOnlyToolLimit} · $
                        {(bundle.task.planDraft.microBudget.tokenBudgetUsd ?? 0).toFixed(2)} · triggered{' '}
                        {bundle.task.planDraft.microBudget.budgetTriggered ? 'yes' : 'no'}
                      </p>
                    ) : null}
                    {bundle.task.planModeTransitions?.length ? (
                      <div className="grid gap-1">
                        <p>Transitions:</p>
                        {bundle.task.planModeTransitions.map(transition => (
                          <p key={`${transition.at}-${transition.to}`}>
                            {transition.from ?? 'init'} {'->'} {transition.to} / {transition.reason}
                          </p>
                        ))}
                      </div>
                    ) : null}
                    {bundle.task.planDraft.decisions?.length ? (
                      <div className="grid gap-1">
                        {bundle.task.planDraft.decisions.map(decision => (
                          <p key={`${decision.questionId}-${decision.answeredAt}`}>
                            {decision.questionId}:{' '}
                            {decision.freeform ??
                              decision.selectedOptionId ??
                              decision.assumedValue ??
                              decision.resolutionSource}
                            {decision.whyAsked ? ` / why ${decision.whyAsked}` : ''}
                            {decision.impactOnPlan ? ` / impact ${decision.impactOnPlan}` : ''}
                          </p>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}
              {bundle.task.critiqueResult ? (
                <div className="grid gap-2 rounded-2xl border border-border/70 bg-muted/30 px-3 py-3">
                  <p className="text-sm font-semibold text-foreground">Critique</p>
                  <div className="grid gap-1 text-xs text-muted-foreground">
                    <p>Decision: {bundle.task.critiqueResult.decision}</p>
                    <p>{bundle.task.critiqueResult.summary}</p>
                    {bundle.task.critiqueResult.shouldBlockEarly ? <p>Early block suggested: true</p> : null}
                    {bundle.task.critiqueResult.blockingIssues?.length ? (
                      <p>Blocking: {bundle.task.critiqueResult.blockingIssues.join(' / ')}</p>
                    ) : null}
                    {bundle.task.critiqueResult.constraints?.length ? (
                      <p>Constraints: {bundle.task.critiqueResult.constraints.join(' / ')}</p>
                    ) : null}
                    <p>
                      Revision: {bundle.task.revisionCount ?? 0}/{bundle.task.maxRevisions ?? 0}
                    </p>
                  </div>
                </div>
              ) : null}
              {resolveCriticalPathSummary(bundle) ? (
                <div className="grid gap-2 rounded-2xl border border-border/70 bg-muted/30 px-3 py-3">
                  <p className="text-sm font-semibold text-foreground">Critical Path</p>
                  <div className="grid gap-1 text-xs text-muted-foreground">
                    <p>Path: {resolveCriticalPathSummary(bundle)?.pathLabel}</p>
                    <p>Total Latency: {resolveCriticalPathSummary(bundle)?.totalLatencyMs}ms</p>
                    {resolveCriticalPathSummary(bundle)?.slowestNode ? (
                      <p>Slowest Span: {resolveCriticalPathSummary(bundle)?.slowestNode}</p>
                    ) : null}
                    {resolveCriticalPathSummary(bundle)?.fallbackNodes.length ? (
                      <p>Fallback Nodes: {resolveCriticalPathSummary(bundle)?.fallbackNodes.join(' / ')}</p>
                    ) : null}
                    {bundle.audit?.traceSummary?.reviseSpans.length ? (
                      <p>Revise Spans: {bundle.audit.traceSummary.reviseSpans.join(' / ')}</p>
                    ) : null}
                  </div>
                </div>
              ) : null}
              <div className="grid gap-2">
                <p className="text-sm font-semibold text-foreground">Trace Waterfall</p>
                {buildTraceWaterfallRows(bundle.traces).map((trace, index) => (
                  <article
                    key={`${trace.spanId ?? trace.node}-${index}`}
                    className="rounded-2xl border border-border/70 bg-muted/30 px-3 py-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <strong className="text-sm text-foreground">{getTraceNodeLabel(trace.node)}</strong>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {trace.chainLabel}
                          {trace.parentNode ? ` / 依赖 ${trace.parentNode}` : ''}
                        </p>
                      </div>
                      <div className="flex flex-wrap justify-end gap-2">
                        {trace.role ? <Badge variant="outline">{trace.role}</Badge> : null}
                        {trace.specialistId ? <Badge variant="outline">{trace.specialistId}</Badge> : null}
                        {typeof trace.latencyMs === 'number' ? (
                          <Badge variant="outline">{trace.latencyMs}ms</Badge>
                        ) : null}
                        {trace.modelUsed ? <Badge variant="outline">{trace.modelUsed}</Badge> : null}
                        {trace.isFallback ? <Badge variant="outline">fallback</Badge> : null}
                      </div>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-border/70">
                      <div
                        className={`h-full rounded-full ${trace.isFallback ? 'bg-amber-500' : 'bg-foreground'}`}
                        style={{ marginLeft: `${trace.offsetPercent}%`, width: `${trace.widthPercent}%` }}
                      />
                    </div>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{getTraceSummaryCopy(trace)}</p>
                    {trace.fallbackReason ? (
                      <p className="mt-2 text-xs leading-5 text-amber-700">fallback reason: {trace.fallbackReason}</p>
                    ) : null}
                  </article>
                ))}
              </div>
              <div className="grid gap-2">
                <p className="text-sm font-semibold text-foreground">Latest Traces</p>
                {buildTraceView(bundle.traces)
                  .slice(-6)
                  .reverse()
                  .map((trace, index) => (
                    <article
                      key={`${trace.node}-${trace.at}-${index}`}
                      className="rounded-2xl border border-border/70 bg-muted/30 px-3 py-3"
                      style={{ marginLeft: `${trace.depth * 12}px` }}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <strong className="text-sm text-foreground">{getTraceNodeLabel(trace.node)}</strong>
                        <span className="text-xs text-muted-foreground">{trace.at}</span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {trace.role ? <Badge variant="outline">{trace.role}</Badge> : null}
                        {trace.status ? <Badge variant="outline">{trace.status}</Badge> : null}
                        {trace.specialistId ? <Badge variant="outline">{trace.specialistId}</Badge> : null}
                        {trace.modelUsed ? <Badge variant="outline">{trace.modelUsed}</Badge> : null}
                        {typeof trace.latencyMs === 'number' ? (
                          <Badge variant="outline">{trace.latencyMs}ms</Badge>
                        ) : null}
                        {trace.isFallback ? <Badge variant="outline">fallback</Badge> : null}
                        {trace.parentSpanId ? <Badge variant="outline">depth {trace.depth}</Badge> : null}
                        {trace.parentNode ? <Badge variant="outline">from {trace.parentNode}</Badge> : null}
                      </div>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">{getTraceSummaryCopy(trace)}</p>
                      {trace.isFallback && trace.fallbackReason ? (
                        <p className="mt-2 text-xs leading-5 text-amber-700">fallback reason: {trace.fallbackReason}</p>
                      ) : null}
                    </article>
                  ))}
              </div>
              {bundle.task.specialistFindings?.length ? (
                <div className="grid gap-2">
                  <p className="text-sm font-semibold text-foreground">Specialist Findings</p>
                  {bundle.task.specialistFindings.map((finding, index) => (
                    <article
                      key={`${finding.specialistId}-${finding.role}-${index}`}
                      className="rounded-2xl border border-border/70 bg-muted/30 px-3 py-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <strong className="text-sm text-foreground">{finding.domain}</strong>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="outline">{finding.contractVersion}</Badge>
                          <Badge variant="outline">{finding.stage}</Badge>
                          <Badge variant="outline">{finding.source}</Badge>
                          <Badge variant="outline">{finding.role}</Badge>
                          <Badge variant="outline">{finding.specialistId}</Badge>
                          {finding.riskLevel ? <Badge variant="outline">{finding.riskLevel}</Badge> : null}
                          {typeof finding.confidence === 'number' ? (
                            <Badge variant="outline">{Math.round(finding.confidence * 100)}%</Badge>
                          ) : null}
                        </div>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">{finding.summary}</p>
                      {renderFindingMeta('阻断项', finding.blockingIssues)}
                      {renderFindingMeta('约束', finding.constraints)}
                      {renderFindingMeta('建议', finding.suggestions)}
                    </article>
                  ))}
                </div>
              ) : null}
              {bundle.audit ? (
                <div className="grid gap-2">
                  <p className="text-sm font-semibold text-foreground">Audit Replay</p>
                  {bundle.audit.entries.slice(0, 6).map(entry => (
                    <article key={entry.id} className="rounded-2xl border border-border/70 bg-muted/30 px-3 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <strong className="text-sm text-foreground">{getAuditEntryTitle(entry)}</strong>
                        <span className="text-xs text-muted-foreground">{entry.at}</span>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">{getAuditEntrySummary(entry)}</p>
                    </article>
                  ))}
                  {bundle.audit.browserReplays.length ? (
                    <div className="rounded-2xl border border-border/70 bg-muted/30 px-3 py-3 text-xs text-muted-foreground">
                      <p className="font-semibold text-foreground">Browser Replays</p>
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
            <p className="text-sm text-muted-foreground">当前没有选中的运行任务。</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function renderFindingMeta(label: string, values?: string[]) {
  if (!values?.length) {
    return null;
  }

  return (
    <p className="mt-2 text-xs leading-5 text-muted-foreground">
      {label}: {values.join('；')}
    </p>
  );
}

export function buildTraceView(traces: TraceRecord[]) {
  const depthBySpan = new Map<string, number>();
  const nodeBySpan = new Map<string, string>();
  return traces.map(trace => {
    const depth = trace.parentSpanId ? (depthBySpan.get(trace.parentSpanId) ?? 0) + 1 : 0;
    if (trace.spanId) {
      depthBySpan.set(trace.spanId, depth);
      nodeBySpan.set(trace.spanId, trace.node);
    }
    return {
      ...trace,
      depth,
      parentNode: trace.parentSpanId ? nodeBySpan.get(trace.parentSpanId) : undefined
    };
  });
}

export function buildTraceWaterfallRows(traces: TraceRecord[]) {
  const traceView = buildTraceView(traces);
  if (!traceView.length) {
    return [];
  }

  const timestamps = traceView
    .map(trace => Date.parse(trace.at))
    .filter(timestamp => Number.isFinite(timestamp))
    .sort((left, right) => left - right);
  const baseTimestamp = timestamps[0] ?? Date.now();
  const maxOffset = Math.max(
    1,
    ...traceView.map(trace => {
      const parsed = Date.parse(trace.at);
      return Number.isFinite(parsed) ? parsed - baseTimestamp : 0;
    })
  );
  const maxLatency = Math.max(
    1,
    ...traceView.map(trace => (typeof trace.latencyMs === 'number' ? trace.latencyMs : 0))
  );

  return traceView.map(trace => {
    const parsed = Date.parse(trace.at);
    const offset = Number.isFinite(parsed) ? parsed - baseTimestamp : 0;
    const widthPercent = typeof trace.latencyMs === 'number' ? Math.max(12, (trace.latencyMs / maxLatency) * 88) : 16;
    const offsetPercent = maxOffset > 0 ? Math.min(76, (offset / maxOffset) * 76) : 0;
    const chainLabel = trace.depth > 0 ? `depth ${trace.depth}` : 'root';
    return {
      ...trace,
      chainLabel,
      offsetPercent,
      widthPercent
    };
  });
}

export function buildCriticalPathSummary(traces: TraceRecord[]) {
  const traceView = buildTraceView(traces);
  if (!traceView.length) {
    return null;
  }

  const childrenByParent = new Map<string | undefined, typeof traceView>();
  for (const trace of traceView) {
    const parent = trace.parentSpanId;
    const current = childrenByParent.get(parent) ?? [];
    current.push(trace);
    childrenByParent.set(parent, current);
  }

  let bestPath: typeof traceView = [];
  let bestLatency = -1;

  function walk(trace: (typeof traceView)[number], chain: typeof traceView, totalLatency: number) {
    const nextChain = [...chain, trace];
    const nextLatency = totalLatency + (trace.latencyMs ?? 0);
    const children = childrenByParent.get(trace.spanId);
    if (!children?.length) {
      if (nextLatency > bestLatency) {
        bestLatency = nextLatency;
        bestPath = nextChain;
      }
      return;
    }
    for (const child of children) {
      walk(child, nextChain, nextLatency);
    }
  }

  for (const root of childrenByParent.get(undefined) ?? []) {
    walk(root, [], 0);
  }

  if (!bestPath.length) {
    return null;
  }

  const slowest = [...bestPath].sort((left, right) => (right.latencyMs ?? 0) - (left.latencyMs ?? 0))[0];
  return {
    pathLabel: bestPath.map(item => item.node).join(' -> '),
    totalLatencyMs: Math.max(0, bestLatency),
    slowestNode: slowest?.node,
    fallbackNodes: bestPath.filter(item => item.isFallback).map(item => item.node)
  };
}

function resolveCriticalPathSummary(bundle: RuntimeOverviewPanelProps['bundle']) {
  const backendSummary = bundle?.audit?.traceSummary;
  if (backendSummary?.criticalPaths?.length) {
    const primary = backendSummary.criticalPaths[0];
    if (!primary) {
      return bundle ? buildCriticalPathSummary(bundle.traces) : null;
    }
    return {
      pathLabel: primary.pathLabel,
      totalLatencyMs: primary.totalLatencyMs,
      slowestNode: backendSummary.slowestSpan?.node,
      fallbackNodes: primary.fallbackNodes
    };
  }

  return bundle ? buildCriticalPathSummary(bundle.traces) : null;
}
