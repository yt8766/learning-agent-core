import { useEffect } from 'react';

import type { RunBundleRecord } from '@agent/core';

import { DashboardEmptyState } from '@/components/dashboard-center-shell';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RunObservatoryFocusCard } from './run-observatory-focus-card';
import {
  buildAgentToolObservatoryDetail,
  buildFocusDomId,
  buildFocusTarget,
  type AgentToolObservatoryFilter,
  type RunObservatoryFocusTarget
} from './run-observatory-panel-support';
import type { AgentGraphOverlayFilter } from '@/pages/runtime-overview/components/runtime-agent-graph-overlay-support';
import type { AgentToolExecutionProjectionInput } from '@/pages/runtime-overview/components/runtime-agent-tool-execution-projections';
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
  agentToolExecutions?: AgentToolExecutionProjectionInput;
  agentToolFilter?: AgentToolObservatoryFilter;
  onAgentToolFilterChange?: (filter: AgentToolObservatoryFilter) => void;
  onGraphFilterChange?: (filter?: AgentGraphOverlayFilter) => void;
  onFocusTargetChange: (target: RunObservatoryFocusTarget) => void;
}) {
  const {
    selectedTaskId,
    loading,
    error,
    detail,
    focusTarget,
    onFocusTargetChange,
    graphFilter,
    onGraphFilterChange,
    agentToolExecutions,
    agentToolFilter = 'all',
    onAgentToolFilterChange
  } = props;

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
  const agentToolObservatory = buildAgentToolObservatoryDetail(agentToolExecutions, selectedTaskId, agentToolFilter);

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
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base font-semibold text-foreground">Agent Tool Observatory</CardTitle>
          <Badge variant="outline">{agentToolObservatory.filter}</Badge>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">requests {agentToolObservatory.counts.requests}</Badge>
            <Badge variant="outline">results {agentToolObservatory.counts.results}</Badge>
            <Badge variant="outline">events {agentToolObservatory.counts.events}</Badge>
            <Badge variant="outline">policy {agentToolObservatory.counts.policyDecisions}</Badge>
          </div>
          <div className="flex flex-wrap gap-2">
            {(['all', 'blocked', 'resumed', 'terminal', 'high_risk'] as const).map(filter => (
              <button key={filter} type="button" onClick={() => onAgentToolFilterChange?.(filter)}>
                <Badge variant={agentToolObservatory.filter === filter ? 'secondary' : 'outline'}>{filter}</Badge>
              </button>
            ))}
          </div>
          {agentToolObservatory.latestItems.length ? (
            <div className="grid gap-2">
              {agentToolObservatory.latestItems.map(item => (
                <article key={item.id} className="rounded-2xl border border-border/70 bg-muted/30 px-4 py-3">
                  <header className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <strong className="text-sm text-foreground">{item.title}</strong>
                      <Badge variant="outline">{item.kind}</Badge>
                    </div>
                    {item.at ? (
                      <span className="text-xs text-muted-foreground">{new Date(item.at).toLocaleString()}</span>
                    ) : null}
                  </header>
                  {item.summary ? <p className="mt-2 text-sm text-muted-foreground">{item.summary}</p> : null}
                </article>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">当前筛选下没有关联的 agent tool execution 详情。</p>
          )}
        </CardContent>
      </Card>
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
