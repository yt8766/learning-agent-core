import { useMemo, type ReactNode } from 'react';

import { Badge } from '@/components/ui/badge';

import {
  summarizeAgentToolExecutions,
  type AgentToolExecutionProjectionInput
} from './runtime-agent-tool-execution-projections';

export function RuntimeAgentToolExecutionSection({
  agentToolExecutions
}: {
  agentToolExecutions?: AgentToolExecutionProjectionInput;
}) {
  const summary = useMemo(() => summarizeAgentToolExecutions(agentToolExecutions), [agentToolExecutions]);
  const hasProjection = Boolean(summary.totals.total) || Boolean(summary.eventLog.latestEvents.length);

  if (!hasProjection) {
    return null;
  }

  return (
    <div className="grid gap-4 rounded-3xl border border-border/70 bg-muted/30 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">Agent Tool Execution</p>
          <p className="mt-1 text-xs text-muted-foreground">
            来自 agent-tools REST / Run Observatory projection 的执行请求、节点、能力与策略判定摘要。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">total {summary.totals.total}</Badge>
          <Badge variant="warning">pending approval {summary.totals.pendingApproval}</Badge>
          <Badge variant="outline">running {summary.totals.running}</Badge>
          <Badge variant="outline">succeeded {summary.totals.succeeded}</Badge>
          <Badge variant="outline">failed {summary.totals.failed}</Badge>
          <Badge variant="outline">cancelled {summary.totals.cancelled}</Badge>
          <Badge variant="warning">blocked events {summary.eventLog.blockedCount}</Badge>
          <Badge variant="secondary">resumed events {summary.eventLog.resumedCount}</Badge>
        </div>
      </div>
      <div className="grid gap-3 xl:grid-cols-5">
        <SummaryPanel title="Requests">
          <div className="grid gap-2">
            {summary.requestQueue.slice(0, 3).map(request => (
              <div key={request.requestId} className="text-xs text-muted-foreground">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={request.status === 'pending_approval' ? 'warning' : 'outline'}>
                    {request.status}
                  </Badge>
                  <span className="font-medium text-foreground">{request.toolName}</span>
                </div>
                <p className="mt-1">
                  {request.status} · {request.riskClass} · {request.nodeLabel} · {request.requestId}
                </p>
                {request.governanceBadges?.length ? (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {request.governanceBadges.map(badge => (
                      <span key={`${request.requestId}:${badge}`}>
                        <Badge variant="outline">{badge}</Badge>
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
            {!summary.requestQueue.length ? (
              <p className="text-xs text-muted-foreground">当前没有 agent tool request。</p>
            ) : null}
          </div>
        </SummaryPanel>
        <SummaryPanel title="Risk Class">
          <div className="flex flex-wrap gap-2">
            {summary.byRiskClass.slice(0, 6).map(group => (
              <span key={group.riskClass}>
                <Badge variant={group.pendingApproval ? 'warning' : 'outline'}>
                  {group.riskClass} · {group.total}
                </Badge>
              </span>
            ))}
          </div>
        </SummaryPanel>
        <SummaryPanel title="Nodes">
          <div className="flex flex-wrap gap-2">
            {summary.byNode.slice(0, 6).map(group => (
              <span key={group.nodeId}>
                <Badge variant={group.pendingApproval ? 'warning' : 'secondary'}>
                  {group.nodeLabel} · {group.total}
                </Badge>
              </span>
            ))}
          </div>
        </SummaryPanel>
        <SummaryPanel title="Policy">
          <div className="grid gap-2">
            {summary.policyDecisions.slice(0, 3).map(decision => (
              <div key={decision.id} className="text-xs text-muted-foreground">
                <Badge variant={decision.decision === 'require_approval' ? 'warning' : 'outline'}>
                  {decision.decision}
                </Badge>
                <span className="ml-2">{decision.reason ?? decision.requestId}</span>
              </div>
            ))}
            {!summary.policyDecisions.length ? (
              <p className="text-xs text-muted-foreground">当前没有策略判定记录。</p>
            ) : null}
          </div>
        </SummaryPanel>
        <SummaryPanel title="Event Log">
          <div className="grid gap-2">
            {summary.eventLog.latestEvents.slice(0, 3).map(event => (
              <div key={event.eventId} className="text-xs text-muted-foreground">
                <Badge variant={event.status === 'blocked' ? 'warning' : 'secondary'}>{event.status}</Badge>
                <span className="ml-2">{event.title}</span>
                <p className="mt-1">
                  {event.requestId}
                  {event.toolName ? ` · ${event.toolName}` : ''}
                  {event.summary ? ` · ${event.summary}` : ''}
                </p>
              </div>
            ))}
            {!summary.eventLog.latestEvents.length ? (
              <p className="text-xs text-muted-foreground">当前没有 agent-tools 事件日志。</p>
            ) : null}
          </div>
        </SummaryPanel>
      </div>
    </div>
  );
}

function SummaryPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-background p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">{title}</p>
      <div className="mt-3">{children}</div>
    </div>
  );
}
