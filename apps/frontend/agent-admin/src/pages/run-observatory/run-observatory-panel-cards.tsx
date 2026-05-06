import type { RunBundleRecord } from '@agent/core';

import { DashboardEmptyState } from '@/components/dashboard-center-shell';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { buildFocusDomId, isFocusedTarget, type RunObservatoryFocusTarget } from './run-observatory-panel-support';
import type { AgentGraphOverlayFilter } from '@/pages/runtime-overview/components/runtime-agent-graph-overlay-support';

export function formatDuration(durationMs?: number) {
  if (typeof durationMs !== 'number') {
    return 'n/a';
  }
  const totalSeconds = Math.max(0, Math.round(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds}s`;
}

export function RelationshipBadges(props: {
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

export function TraceCard(props: {
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

export function TimelineCard(props: { detail: RunBundleRecord; filter?: AgentGraphOverlayFilter }) {
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

export function CheckpointCard(props: {
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

export function InterruptLedgerCard(props: {
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

export function EvidenceCard(props: {
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

export function DiagnosticsCard(props: {
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
