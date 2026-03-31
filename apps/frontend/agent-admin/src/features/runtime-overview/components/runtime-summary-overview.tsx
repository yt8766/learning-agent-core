import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DashboardEmptyState, DashboardMetricGrid } from '@/components/dashboard-center-shell';

import type { RuntimeSummarySectionProps } from './runtime-summary-types';

export function RuntimeSummaryOverview({ runtime }: Pick<RuntimeSummarySectionProps, 'runtime'>) {
  return (
    <>
      <DashboardMetricGrid
        items={[
          {
            label: '运行 Profile',
            value: runtime.runtimeProfile ?? 'platform',
            detail: `审批 ${runtime.policy?.approvalMode ?? 'balanced'} / 来源 ${runtime.policy?.sourcePolicyMode ?? 'controlled-first'}`
          },
          { label: '活跃任务', value: runtime.activeTaskCount, detail: `总任务 ${runtime.taskCount}` },
          {
            label: '队列深度',
            value: runtime.queueDepth,
            detail: `阻塞 ${runtime.blockedRunCount} / 预算耗尽 ${runtime.budgetExceededCount ?? 0}`
          },
          {
            label: '待审批',
            value: runtime.pendingApprovalCount,
            detail: `会话 ${runtime.activeSessionCount}/${runtime.sessionCount}`
          },
          {
            label: '中断超时',
            value: runtime.interruptTimeoutCount ?? 0,
            detail: `平均等待 ${(runtime.waitingInterruptAverageMinutes ?? 0).toFixed(1)} 分钟`
          },
          {
            label: 'Agent 错误',
            value: runtime.recentAgentErrors?.length ?? 0,
            detail: runtime.recentAgentErrors?.[0]?.message ?? '最近没有捕获到新的 agent 级结构化异常'
          },
          {
            label: '诊断沉淀',
            value: runtime.diagnosisEvidenceCount ?? 0,
            detail:
              (runtime.diagnosisEvidenceCount ?? 0) > 0
                ? '已有 diagnosis_result 可在 Evidence Center 复用'
                : '当前还没有形成可复用的诊断结果'
          },
          {
            label: '活跃尚书',
            value: runtime.activeMinistries.length,
            detail: runtime.activeWorkers.join(' / ') || '暂无'
          },
          {
            label: '后台运行',
            value: runtime.backgroundRunCount ?? 0,
            detail: `前台 ${runtime.foregroundRunCount ?? 0} / lease ${runtime.leasedBackgroundRunCount ?? 0} / stale ${runtime.staleLeaseCount ?? 0}`
          },
          {
            label: 'Worker Pool',
            value: runtime.activeWorkerSlotCount ?? 0,
            detail: `总槽位 ${runtime.workerPoolSize ?? 0} / 可用 ${runtime.availableWorkerSlotCount ?? 0}`
          }
        ].map(card => ({ label: card.label, value: card.value, note: card.detail }))}
      />

      {runtime.policy ? (
        <Card className="border-border/70 bg-card/90 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-foreground">Runtime Policy</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Badge variant="secondary">审批 {runtime.policy.approvalMode}</Badge>
            <Badge variant="secondary">Skill 安装 {runtime.policy.skillInstallMode}</Badge>
            <Badge variant="secondary">学习 {runtime.policy.learningMode}</Badge>
            <Badge variant="secondary">来源 {runtime.policy.sourcePolicyMode}</Badge>
            <Badge variant="secondary">步骤预算 {runtime.policy.budget.stepBudget}</Badge>
            <Badge variant="secondary">重试预算 {runtime.policy.budget.retryBudget}</Badge>
            <Badge variant="secondary">来源预算 {runtime.policy.budget.sourceBudget}</Badge>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <RegistryCard
          title="Subgraph Registry"
          count={runtime.subgraphs?.length ?? 0}
          emptyText="当前还没有 subgraph 描述符。"
          items={runtime.subgraphs?.map(item => (
            <article key={item.id} className="rounded-2xl border border-border/70 bg-muted/30 px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">{item.displayName}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                </div>
                <Badge variant="secondary">{item.id}</Badge>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge variant="outline">owner {item.owner}</Badge>
                {item.entryNodes.map(node => (
                  <span key={`${item.id}-${node}`}>
                    <Badge variant="outline">{node}</Badge>
                  </span>
                ))}
              </div>
            </article>
          ))}
        />
        <RegistryCard
          title="Workflow Versions"
          count={runtime.workflowVersions?.length ?? 0}
          emptyText="当前还没有 workflow 版本记录。"
          items={runtime.workflowVersions?.map(item => (
            <article
              key={`${item.workflowId}:${item.version}`}
              className="rounded-2xl border border-border/70 bg-muted/30 px-4 py-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">{item.workflowId}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{new Date(item.updatedAt).toLocaleString()}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">v{item.version}</Badge>
                  <Badge variant={item.status === 'active' ? 'success' : 'secondary'}>{item.status}</Badge>
                </div>
              </div>
              {item.changelog?.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {item.changelog.map(change => (
                    <span key={`${item.workflowId}-${change}`}>
                      <Badge variant="outline">{change}</Badge>
                    </span>
                  ))}
                </div>
              ) : null}
            </article>
          ))}
        />
      </div>
    </>
  );
}

function RegistryCard(props: { title: string; count: number; emptyText: string; items?: React.ReactNode[] }) {
  return (
    <Card className="border-border/70 bg-card/90 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg font-semibold text-foreground">{props.title}</CardTitle>
        <Badge variant="outline">{props.count}</Badge>
      </CardHeader>
      <CardContent className="grid gap-3">
        {!props.items?.length ? <DashboardEmptyState message={props.emptyText} /> : props.items}
      </CardContent>
    </Card>
  );
}
