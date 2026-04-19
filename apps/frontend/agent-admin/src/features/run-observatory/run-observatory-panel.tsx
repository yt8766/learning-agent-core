import { useEffect } from 'react';

import type { RunBundleRecord } from '@agent/core';

import { DashboardEmptyState } from '@/components/dashboard-center-shell';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RunObservatoryFocusCard } from './run-observatory-focus-card';
import {
  buildFocusDomId,
  buildFocusTarget,
  isFocusedTarget,
  type RunObservatoryFocusTarget
} from './run-observatory-panel-support';
import type { AgentGraphOverlayFilter } from '@/features/runtime-overview/components/runtime-agent-graph-overlay-support';

function formatDuration(durationMs?: number) {
  if (typeof durationMs !== 'number') {
    return 'n/a';
  }
  const totalSeconds = Math.max(0, Math.round(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds}s`;
}

function RelationshipBadges(props: {
  stage?: string;
  checkpointId?: string;
  spanId?: string;
  evidenceId?: string;
  onJump?: (target: Exclude<RunObservatoryFocusTarget, undefined>) => void;
}) {
  const { stage, checkpointId, spanId, evidenceId, onJump } = props;
  if (!stage && !checkpointId && !spanId && !evidenceId) {
    return null;
  }

  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {stage ? <Badge variant="outline">stage {stage}</Badge> : null}
      {checkpointId ? (
        <button type="button" onClick={() => onJump?.({ kind: 'checkpoint', id: checkpointId })}>
          <Badge variant="outline">checkpoint {checkpointId}</Badge>
        </button>
      ) : null}
      {spanId ? (
        <button type="button" onClick={() => onJump?.({ kind: 'span', id: spanId })}>
          <Badge variant="outline">span {spanId}</Badge>
        </button>
      ) : null}
      {evidenceId ? (
        <button type="button" onClick={() => onJump?.({ kind: 'evidence', id: evidenceId })}>
          <Badge variant="outline">evidence {evidenceId}</Badge>
        </button>
      ) : null}
    </div>
  );
}

function TraceCard(props: {
  detail: RunBundleRecord;
  focusTarget?: RunObservatoryFocusTarget;
  filter?: AgentGraphOverlayFilter;
}) {
  const traces = props.filter
    ? props.detail.traces.filter(item => props.filter?.spanIds.includes(item.spanId))
    : props.detail.traces;
  return (
    <Card className="border-border/70 bg-card/90 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base font-semibold text-foreground">Trace Waterfall</CardTitle>
        <Badge variant="outline">{traces.length}</Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        {traces.length ? (
          traces.map(trace => (
            <article
              id={buildFocusDomId({ kind: 'span', id: trace.spanId })}
              tabIndex={-1}
              key={trace.spanId}
              className={`rounded-2xl border px-4 py-3 ${
                isFocusedTarget(props.focusTarget, { kind: 'span', id: trace.spanId })
                  ? 'border-emerald-500 bg-emerald-50/80'
                  : 'border-border/70 bg-muted/30'
              }`}
            >
              <header className="flex flex-wrap items-center gap-2">
                <strong className="text-sm text-foreground">{trace.node}</strong>
                <Badge variant="outline">{trace.stage}</Badge>
                <Badge variant="outline">{trace.status}</Badge>
                {trace.modelUsed ? <Badge variant="outline">{trace.modelUsed}</Badge> : null}
                {typeof trace.latencyMs === 'number' ? <Badge variant="outline">{trace.latencyMs}ms</Badge> : null}
                {trace.isFallback ? <Badge variant="secondary">fallback</Badge> : null}
              </header>
              <p className="mt-2 text-sm text-muted-foreground">{trace.summary}</p>
            </article>
          ))
        ) : (
          <DashboardEmptyState message="当前 run 还没有 trace 数据。" />
        )}
      </CardContent>
    </Card>
  );
}

function TimelineCard(props: { detail: RunBundleRecord; filter?: AgentGraphOverlayFilter }) {
  const timeline = props.filter
    ? props.detail.timeline.filter(item => props.filter?.stages.includes(item.stage))
    : props.detail.timeline;
  return (
    <Card className="border-border/70 bg-card/90 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base font-semibold text-foreground">Stage Timeline</CardTitle>
        <Badge variant="outline">{timeline.length}</Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        {timeline.length ? (
          timeline.map(item => (
            <article key={item.id} className="rounded-2xl border border-border/70 bg-muted/30 px-4 py-3">
              <header className="flex flex-wrap items-center gap-2">
                <strong className="text-sm text-foreground">{item.title}</strong>
                <Badge variant="outline">{item.stage}</Badge>
                <Badge variant="outline">{item.status}</Badge>
              </header>
              <p className="mt-2 text-sm text-muted-foreground">{item.summary}</p>
            </article>
          ))
        ) : (
          <DashboardEmptyState message="当前 run 还没有 timeline 数据。" />
        )}
      </CardContent>
    </Card>
  );
}

function CheckpointCard(props: {
  detail: RunBundleRecord;
  focusTarget?: RunObservatoryFocusTarget;
  filter?: AgentGraphOverlayFilter;
}) {
  const checkpoints = props.filter
    ? props.detail.checkpoints.filter(item => props.filter?.checkpointIds.includes(item.checkpointId))
    : props.detail.checkpoints;
  return (
    <Card className="border-border/70 bg-card/90 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base font-semibold text-foreground">Checkpoint Replay</CardTitle>
        <Badge variant="outline">{checkpoints.length}</Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        {checkpoints.length ? (
          checkpoints.map(checkpoint => (
            <article
              id={buildFocusDomId({ kind: 'checkpoint', id: checkpoint.checkpointId })}
              tabIndex={-1}
              key={checkpoint.checkpointId}
              className={`rounded-2xl border px-4 py-3 ${
                isFocusedTarget(props.focusTarget, { kind: 'checkpoint', id: checkpoint.checkpointId })
                  ? 'border-emerald-500 bg-emerald-50/80'
                  : 'border-border/70 bg-muted/30'
              }`}
            >
              <header className="flex flex-wrap items-center gap-2">
                <strong className="text-sm text-foreground">{checkpoint.checkpointId}</strong>
                <Badge variant="outline">{checkpoint.recoverability}</Badge>
                {checkpoint.recoverable ? <Badge variant="secondary">recoverable</Badge> : null}
              </header>
              <p className="mt-2 text-sm text-muted-foreground">{checkpoint.summary}</p>
            </article>
          ))
        ) : (
          <DashboardEmptyState message="当前 run 没有 checkpoint 摘要。" />
        )}
      </CardContent>
    </Card>
  );
}

function InterruptLedgerCard(props: {
  detail: RunBundleRecord;
  onJump: (target: Exclude<RunObservatoryFocusTarget, undefined>) => void;
  filter?: AgentGraphOverlayFilter;
}) {
  const { detail, onJump } = props;
  const interrupts = props.filter
    ? detail.interrupts.filter(item => props.filter?.interruptIds.includes(item.id))
    : detail.interrupts;
  return (
    <Card className="border-border/70 bg-card/90 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base font-semibold text-foreground">Interrupt Ledger</CardTitle>
        <Badge variant="outline">{interrupts.length}</Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        {interrupts.length ? (
          interrupts.map(item => (
            <article key={item.id} className="rounded-2xl border border-border/70 bg-muted/30 px-4 py-3">
              <header className="flex flex-wrap items-center gap-2">
                <strong className="text-sm text-foreground">{item.title}</strong>
                <Badge variant="outline">{item.kind}</Badge>
                <Badge variant="outline">{item.status}</Badge>
              </header>
              <p className="mt-2 text-sm text-muted-foreground">{item.summary}</p>
              <RelationshipBadges
                stage={item.stage}
                checkpointId={item.relatedCheckpointId}
                spanId={item.relatedSpanId}
                onJump={onJump}
              />
              {item.feedback ? <p className="mt-2 text-xs text-muted-foreground">feedback: {item.feedback}</p> : null}
            </article>
          ))
        ) : (
          <DashboardEmptyState message="当前 run 暂无 interrupt ledger。" />
        )}
      </CardContent>
    </Card>
  );
}

function EvidenceCard(props: {
  detail: RunBundleRecord;
  focusTarget?: RunObservatoryFocusTarget;
  onJump: (target: Exclude<RunObservatoryFocusTarget, undefined>) => void;
  filter?: AgentGraphOverlayFilter;
}) {
  const { detail, focusTarget, onJump } = props;
  const evidence = props.filter
    ? detail.evidence.filter(item => props.filter?.evidenceIds.includes(item.id))
    : detail.evidence;
  return (
    <Card className="border-border/70 bg-card/90 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base font-semibold text-foreground">Evidence</CardTitle>
        <Badge variant="outline">{evidence.length}</Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        {evidence.length ? (
          evidence.map(item => (
            <article
              id={buildFocusDomId({ kind: 'evidence', id: item.id })}
              tabIndex={-1}
              key={item.id}
              className={`rounded-2xl border px-4 py-3 ${
                isFocusedTarget(focusTarget, { kind: 'evidence', id: item.id })
                  ? 'border-emerald-500 bg-emerald-50/80'
                  : 'border-border/70 bg-muted/30'
              }`}
            >
              <header className="flex flex-wrap items-center gap-2">
                <strong className="text-sm text-foreground">{item.title ?? item.id}</strong>
                {item.sourceType ? <Badge variant="outline">{item.sourceType}</Badge> : null}
                {item.trustLevel ? <Badge variant="outline">{item.trustLevel}</Badge> : null}
                {item.stage ? <Badge variant="outline">{item.stage}</Badge> : null}
              </header>
              <p className="mt-2 text-sm text-muted-foreground">{item.summary}</p>
              <RelationshipBadges
                stage={item.stage}
                checkpointId={item.linkedCheckpointId}
                spanId={item.linkedSpanId}
                evidenceId={item.id}
                onJump={onJump}
              />
            </article>
          ))
        ) : (
          <DashboardEmptyState message="当前 run 暂无 evidence。" />
        )}
      </CardContent>
    </Card>
  );
}

function DiagnosticsCard(props: {
  detail: RunBundleRecord;
  onJump: (target: Exclude<RunObservatoryFocusTarget, undefined>) => void;
  filter?: AgentGraphOverlayFilter;
}) {
  const { detail, onJump } = props;
  const diagnostics = props.filter
    ? detail.diagnostics.filter(item => props.filter?.diagnosticIds.includes(item.id))
    : detail.diagnostics;
  return (
    <Card className="border-border/70 bg-card/90 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base font-semibold text-foreground">Diagnostics</CardTitle>
        <Badge variant="outline">{diagnostics.length}</Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        {diagnostics.length ? (
          diagnostics.map(item => (
            <article key={item.id} className="rounded-2xl border border-border/70 bg-muted/30 px-4 py-3">
              <header className="flex flex-wrap items-center gap-2">
                <strong className="text-sm text-foreground">{item.title}</strong>
                <Badge variant="outline">{item.kind}</Badge>
                <Badge variant="outline">{item.severity}</Badge>
              </header>
              <p className="mt-2 text-sm text-muted-foreground">{item.summary}</p>
              <RelationshipBadges
                stage={item.linkedStage}
                checkpointId={item.linkedCheckpointId}
                spanId={item.linkedSpanId}
                onJump={onJump}
              />
            </article>
          ))
        ) : (
          <DashboardEmptyState message="当前 run 暂无诊断提示。" />
        )}
      </CardContent>
    </Card>
  );
}

export function RunObservatoryPanel(props: {
  selectedTaskId?: string;
  loading: boolean;
  error?: string;
  detail: RunBundleRecord | null;
  focusTarget?: RunObservatoryFocusTarget;
  graphFilter?: AgentGraphOverlayFilter;
  onGraphFilterChange?: (filter?: AgentGraphOverlayFilter) => void;
  onFocusTargetChange: (target: RunObservatoryFocusTarget) => void;
}) {
  const { selectedTaskId, loading, error, detail, focusTarget, onFocusTargetChange, graphFilter, onGraphFilterChange } =
    props;

  useEffect(() => {
    if (!focusTarget || typeof document === 'undefined') {
      return;
    }

    const element = document.getElementById(buildFocusDomId(focusTarget));
    if (!element) {
      return;
    }

    element.scrollIntoView({
      block: 'center',
      behavior: 'smooth'
    });
  }, [focusTarget]);

  if (!selectedTaskId) {
    return <DashboardEmptyState message="选择一个 run 后，这里会显示执行观测详情。" />;
  }

  if (loading && !detail) {
    return <DashboardEmptyState message="正在加载 run observability 详情..." />;
  }

  if (error) {
    return <DashboardEmptyState message={error} />;
  }

  if (!detail) {
    return <DashboardEmptyState message="当前 run 暂无 observability 详情。" />;
  }

  const defaultTarget = buildFocusTarget({
    checkpointId: detail.checkpoints[0]?.checkpointId,
    spanId: detail.traces[0]?.spanId,
    evidenceId: detail.evidence[0]?.id
  });

  return (
    <div className="grid gap-4">
      <Card className="border-border/70 bg-card/90 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-lg font-semibold text-foreground">Execution Observatory</CardTitle>
          <Badge variant="outline">{detail.run.status}</Badge>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <div className="rounded-2xl border border-border/70 bg-muted/30 px-4 py-3">
            <p className="text-xs text-muted-foreground">Goal</p>
            <p className="mt-1 text-sm font-medium text-foreground">{detail.run.goal}</p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-muted/30 px-4 py-3">
            <p className="text-xs text-muted-foreground">Duration</p>
            <p className="mt-1 text-sm font-medium text-foreground">{formatDuration(detail.run.durationMs)}</p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-muted/30 px-4 py-3">
            <p className="text-xs text-muted-foreground">Current Stage</p>
            <p className="mt-1 text-sm font-medium text-foreground">{detail.run.currentStage ?? 'n/a'}</p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-muted/30 px-4 py-3">
            <p className="text-xs text-muted-foreground">Owner</p>
            <p className="mt-1 text-sm font-medium text-foreground">
              {detail.run.currentMinistry ?? 'n/a'} / {detail.run.currentWorker ?? 'n/a'}
            </p>
          </div>
        </CardContent>
      </Card>

      <TimelineCard detail={detail} filter={graphFilter} />
      <Card className="border-border/70 bg-card/90 shadow-sm">
        <CardContent className="flex flex-wrap gap-2 pt-6">
          <button type="button" onClick={() => onFocusTargetChange(defaultTarget)}>
            <Badge variant="secondary">聚焦默认关联</Badge>
          </button>
          {graphFilter ? (
            <button type="button" onClick={() => onGraphFilterChange?.(undefined)}>
              <Badge variant="warning">节点过滤 {graphFilter.label}</Badge>
            </button>
          ) : null}
          {focusTarget ? (
            <Badge variant="outline">
              {focusTarget.kind} {focusTarget.id}
            </Badge>
          ) : null}
        </CardContent>
      </Card>
      <RunObservatoryFocusCard detail={detail} focusTarget={focusTarget} onFocusTargetChange={onFocusTargetChange} />
      <TraceCard detail={detail} focusTarget={focusTarget} filter={graphFilter} />
      <CheckpointCard detail={detail} focusTarget={focusTarget} filter={graphFilter} />
      <InterruptLedgerCard detail={detail} onJump={onFocusTargetChange} filter={graphFilter} />
      <EvidenceCard detail={detail} focusTarget={focusTarget} onJump={onFocusTargetChange} filter={graphFilter} />
      <DiagnosticsCard detail={detail} onJump={onFocusTargetChange} filter={graphFilter} />
    </div>
  );
}
