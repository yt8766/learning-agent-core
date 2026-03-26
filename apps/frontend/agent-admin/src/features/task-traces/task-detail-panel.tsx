import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

import type { AgentStateRecord, ReviewRecord, TaskBundle } from '../../types/admin';

interface TaskDetailPanelProps {
  bundle: TaskBundle | null;
}

function AgentStateGrid({ agents }: { agents: AgentStateRecord[] }) {
  return (
    <Card className="col-span-12 border-stone-200 bg-white/90 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-lg font-semibold text-stone-900">Agent 状态</CardTitle>
        <Badge variant="outline">{agents.length} 个 Agent</Badge>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {agents.map(agent => (
          <article key={agent.agentId} className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-stone-900">{agent.role}</h3>
              <Badge variant="secondary">{agent.status}</Badge>
            </div>
            <p className="mt-3 text-sm text-stone-700">{agent.subTask ?? '未分配子任务'}</p>
            <p className="mt-2 text-xs leading-5 text-stone-500">工具：{agent.toolCalls.join(' | ') || '暂无'}</p>
            <p className="mt-1 text-xs leading-5 text-stone-500">
              短期记忆：{agent.shortTermMemory.join(' / ') || '暂无'}
            </p>
          </article>
        ))}
      </CardContent>
    </Card>
  );
}

function ReviewTag({ review }: { review?: ReviewRecord }) {
  return <Badge variant="outline">{review?.decision ?? '暂无'}</Badge>;
}

export function TaskDetailPanel({ bundle }: TaskDetailPanelProps) {
  return (
    <>
      <Card className="col-span-12 border-stone-200 bg-white/90 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-lg font-semibold text-stone-900">任务详情</CardTitle>
          <Badge variant="secondary">{bundle?.task.status ?? '未选择'}</Badge>
        </CardHeader>
        <CardContent className="space-y-5">
          <ul className="grid gap-3 text-sm text-stone-600">
            <li className="flex items-center justify-between gap-4 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3">
              <strong className="text-stone-900">任务 ID</strong>
              <span>{bundle?.task.id ?? '暂无'}</span>
            </li>
            <li className="flex items-center justify-between gap-4 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3">
              <strong className="text-stone-900">目标</strong>
              <span>{bundle?.task.goal ?? '暂无'}</span>
            </li>
            <li className="flex items-center justify-between gap-4 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3">
              <strong className="text-stone-900">当前节点</strong>
              <span>{bundle?.task.currentStep ?? '暂无'}</span>
            </li>
            <li className="flex items-center justify-between gap-4 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3">
              <strong className="text-stone-900">Workflow</strong>
              <span>
                {bundle?.task.resolvedWorkflow
                  ? `${bundle.task.resolvedWorkflow.id} v${bundle.task.resolvedWorkflow.version ?? '1.0.0'}`
                  : '暂无'}
              </span>
            </li>
            <li className="flex items-center justify-between gap-4 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3">
              <strong className="text-stone-900">Subgraphs</strong>
              <span>{bundle?.task.subgraphTrail?.join(' / ') ?? '暂无'}</span>
            </li>
            <li className="flex items-center justify-between gap-4 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3">
              <strong className="text-stone-900">重试次数</strong>
              <span>{bundle ? `${bundle.task.retryCount ?? 0}/${bundle.task.maxRetries ?? 1}` : '暂无'}</span>
            </li>
            <li className="flex items-center justify-between gap-4 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3">
              <strong className="text-stone-900">最终结果</strong>
              <span>{bundle?.task.result ?? '暂无输出'}</span>
            </li>
            <li className="flex items-center justify-between gap-4 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3">
              <strong className="text-stone-900">评审结论</strong>
              <ReviewTag review={bundle?.review} />
            </li>
          </ul>
          <Separator />
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-stone-900">主计划</h3>
            <ol className="space-y-2 pl-5 text-sm leading-6 text-stone-600">
              {(bundle?.plan?.steps ?? []).map(step => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </div>
        </CardContent>
      </Card>

      <Card className="col-span-12 border-stone-200 bg-white/90 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-lg font-semibold text-stone-900">消息流</CardTitle>
          <Badge variant="outline">{bundle?.messages.length ?? 0}</Badge>
        </CardHeader>
        <CardContent className="space-y-3">
          {(bundle?.messages ?? []).map(message => (
            <article key={message.id} className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3">
              <header className="flex flex-wrap items-center gap-2 text-xs text-stone-500">
                <strong className="text-sm text-stone-900">{message.from}</strong>
                <Badge variant="outline">{message.type}</Badge>
                <small>{message.to}</small>
              </header>
              <p className="mt-2 text-sm leading-6 text-stone-700">{message.content}</p>
            </article>
          ))}
        </CardContent>
      </Card>

      <Card className="col-span-12 border-stone-200 bg-white/90 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-lg font-semibold text-stone-900">执行轨迹</CardTitle>
          <Badge variant="outline">{bundle?.traces.length ?? 0}</Badge>
        </CardHeader>
        <CardContent className="space-y-3">
          {(bundle?.traces ?? []).map((trace, index) => (
            <article
              key={`${trace.node}-${index}`}
              className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3"
            >
              <header className="flex items-center justify-between gap-3">
                <strong className="text-sm font-semibold text-stone-900">{trace.node}</strong>
                <small className="text-xs text-stone-500">{trace.at}</small>
              </header>
              <p className="mt-2 text-sm leading-6 text-stone-700">{trace.summary}</p>
            </article>
          ))}
        </CardContent>
      </Card>

      {bundle?.audit ? (
        <Card className="col-span-12 border-stone-200 bg-white/90 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-lg font-semibold text-stone-900">审计回放</CardTitle>
            <Badge variant="outline">{bundle.audit.entries.length}</Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            {bundle.audit.entries.map(entry => (
              <article key={entry.id} className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3">
                <header className="flex items-center justify-between gap-3">
                  <strong className="text-sm font-semibold text-stone-900">
                    {entry.type} / {entry.title}
                  </strong>
                  <small className="text-xs text-stone-500">{entry.at}</small>
                </header>
                <p className="mt-2 text-sm leading-6 text-stone-700">{entry.summary}</p>
              </article>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <AgentStateGrid agents={bundle?.agents ?? []} />
    </>
  );
}
