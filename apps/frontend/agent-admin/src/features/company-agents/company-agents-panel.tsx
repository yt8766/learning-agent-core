import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DashboardCenterShell, DashboardEmptyState } from '@/components/dashboard-center-shell';

import type { CompanyAgentRecord } from '@/types/admin';

interface CompanyAgentsPanelProps {
  agents: CompanyAgentRecord[];
  onEnableAgent: (workerId: string) => void;
  onDisableAgent: (workerId: string) => void;
}

export function CompanyAgentsPanel({ agents, onEnableAgent, onDisableAgent }: CompanyAgentsPanelProps) {
  return (
    <DashboardCenterShell
      title="Company Agents"
      description="查看专员治理状态、能力依赖与最近目标。"
      count={agents.length}
    >
      <div className="grid gap-4">
        {agents.length === 0 ? (
          <DashboardEmptyState message="当前还没有已注册的公司专员。" />
        ) : (
          agents.map(agent => (
            <article key={agent.id} className="rounded-2xl border border-border/70 bg-card/90 px-4 py-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">{agent.displayName}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{agent.id}</p>
                </div>
                <Badge variant={agent.enabled === false ? 'warning' : agent.activeTaskCount ? 'success' : 'secondary'}>
                  {agent.governanceStatus ?? 'ready'}
                </Badge>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge variant="secondary">{agent.ministry}</Badge>
                <Badge variant="secondary">{agent.defaultModel}</Badge>
                {agent.owner ? <Badge variant="secondary">{agent.owner}</Badge> : null}
                {typeof agent.activeTaskCount === 'number' ? (
                  <Badge variant="outline">active {agent.activeTaskCount}</Badge>
                ) : null}
                {typeof agent.totalTaskCount === 'number' ? (
                  <Badge variant="outline">used {agent.totalTaskCount}</Badge>
                ) : null}
                {typeof agent.successRate === 'number' ? (
                  <Badge variant="secondary">成功率 {(agent.successRate * 100).toFixed(0)}%</Badge>
                ) : null}
                {agent.promotionState ? <Badge variant="secondary">{agent.promotionState}</Badge> : null}
              </div>
              {agent.tags?.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {agent.tags.map(tag => (
                    <span key={`${agent.id}-${tag}`}>
                      <Badge variant="outline">{tag}</Badge>
                    </span>
                  ))}
                </div>
              ) : null}
              {agent.requiredConnectors?.length ? (
                <p className="mt-3 text-xs text-muted-foreground">connectors: {agent.requiredConnectors.join(', ')}</p>
              ) : null}
              {agent.recentTaskGoals?.length ? (
                <div className="mt-3 rounded-xl border border-border/70 bg-muted/20 px-3 py-3">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Recent Goals</p>
                  <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                    {agent.recentTaskGoals.map(goal => (
                      <li key={`${agent.id}-${goal}`}>{goal}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {agent.sourceRuns?.length ? (
                <p className="mt-3 text-xs text-muted-foreground">
                  source runs: {agent.sourceRuns.slice(0, 3).join(', ')}
                </p>
              ) : null}
              <div className="mt-3">
                <Button
                  type="button"
                  size="sm"
                  variant={agent.enabled === false ? 'default' : 'outline'}
                  onClick={() => (agent.enabled === false ? onEnableAgent(agent.id) : onDisableAgent(agent.id))}
                >
                  {agent.enabled === false ? '启用专员' : '停用专员'}
                </Button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {agent.supportedCapabilities.map(capability => (
                  <span key={`${agent.id}-${capability}`}>
                    <Badge variant="outline">{capability}</Badge>
                  </span>
                ))}
              </div>
            </article>
          ))
        )}
      </div>
    </DashboardCenterShell>
  );
}
