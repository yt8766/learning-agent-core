import { useEffect } from 'react';

import type { RunBundleRecord } from '@agent/core';

import { DashboardEmptyState } from '@/components/dashboard-center-shell';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RunObservatoryFocusCard } from './run-observatory-focus-card';
import { buildFocusDomId, buildFocusTarget, type RunObservatoryFocusTarget } from './run-observatory-panel-support';
import type { AgentGraphOverlayFilter } from '@/features/runtime-overview/components/runtime-agent-graph-overlay-support';
import {
  CheckpointCard,
  DiagnosticsCard,
  EvidenceCard,
  formatDuration,
  InterruptLedgerCard,
  TimelineCard,
  TraceCard
} from './run-observatory-panel-cards';

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
