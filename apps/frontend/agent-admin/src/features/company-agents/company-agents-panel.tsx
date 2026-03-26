import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import type { CompanyAgentRecord } from '../../types/admin';

interface CompanyAgentsPanelProps {
  agents: CompanyAgentRecord[];
  onEnableAgent: (workerId: string) => void;
  onDisableAgent: (workerId: string) => void;
}

export function CompanyAgentsPanel({ agents, onEnableAgent, onDisableAgent }: CompanyAgentsPanelProps) {
  return (
    <Card className="rounded-3xl border-stone-200 bg-white shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg font-semibold text-stone-950">Company Agents</CardTitle>
        <Badge variant="outline">{agents.length}</Badge>
      </CardHeader>
      <CardContent className="grid gap-4">
        {agents.length === 0 ? (
          <p className="text-sm text-stone-500">当前还没有已注册的公司专员。</p>
        ) : (
          agents.map(agent => (
            <article key={agent.id} className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-stone-950">{agent.displayName}</p>
                  <p className="mt-1 text-xs text-stone-500">{agent.id}</p>
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
                <p className="mt-3 text-xs text-stone-500">connectors: {agent.requiredConnectors.join(', ')}</p>
              ) : null}
              {agent.recentTaskGoals?.length ? (
                <div className="mt-3 rounded-xl border border-stone-200 bg-white px-3 py-3">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-stone-500">Recent Goals</p>
                  <ul className="mt-2 space-y-1 text-sm text-stone-600">
                    {agent.recentTaskGoals.map(goal => (
                      <li key={`${agent.id}-${goal}`}>{goal}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {agent.sourceRuns?.length ? (
                <p className="mt-3 text-xs text-stone-500">source runs: {agent.sourceRuns.slice(0, 3).join(', ')}</p>
              ) : null}
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => (agent.enabled === false ? onEnableAgent(agent.id) : onDisableAgent(agent.id))}
                  className="rounded-full border border-stone-300 bg-white px-3 py-1 text-xs text-stone-700"
                >
                  {agent.enabled === false ? '启用专员' : '停用专员'}
                </button>
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
      </CardContent>
    </Card>
  );
}
