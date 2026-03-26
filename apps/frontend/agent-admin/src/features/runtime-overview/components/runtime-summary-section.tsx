import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import type { RuntimeOverviewPanelProps } from './runtime-overview-types';

export function RuntimeSummarySection({ runtime }: Pick<RuntimeOverviewPanelProps, 'runtime'>) {
  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
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
        ].map(card => (
          <Card key={card.label} className="rounded-3xl border-stone-200 bg-white shadow-sm">
            <CardContent className="p-6">
              <p className="text-sm text-stone-500">{card.label}</p>
              <p className="mt-4 text-4xl font-semibold tracking-tight text-stone-950">{card.value}</p>
              <p className="mt-3 text-sm text-stone-500">{card.detail}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {runtime.policy ? (
        <Card className="rounded-3xl border-stone-200 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-stone-950">Runtime Policy</CardTitle>
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
        <Card className="rounded-3xl border-stone-200 bg-white shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-semibold text-stone-950">Subgraph Registry</CardTitle>
            <Badge variant="outline">{runtime.subgraphs?.length ?? 0}</Badge>
          </CardHeader>
          <CardContent className="grid gap-3">
            {!runtime.subgraphs?.length ? (
              <p className="text-sm text-stone-500">当前还没有 subgraph 描述符。</p>
            ) : (
              runtime.subgraphs.map(item => (
                <article key={item.id} className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-stone-950">{item.displayName}</p>
                      <p className="mt-1 text-sm text-stone-600">{item.description}</p>
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
              ))
            )}
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-stone-200 bg-white shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-semibold text-stone-950">Workflow Versions</CardTitle>
            <Badge variant="outline">{runtime.workflowVersions?.length ?? 0}</Badge>
          </CardHeader>
          <CardContent className="grid gap-3">
            {!runtime.workflowVersions?.length ? (
              <p className="text-sm text-stone-500">当前还没有 workflow 版本记录。</p>
            ) : (
              runtime.workflowVersions.map(item => (
                <article
                  key={`${item.workflowId}:${item.version}`}
                  className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-stone-950">{item.workflowId}</p>
                      <p className="mt-1 text-xs text-stone-500">{new Date(item.updatedAt).toLocaleString()}</p>
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
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {[
          {
            label: '估算 Prompt Tokens',
            value: runtime.usageAnalytics.totalEstimatedPromptTokens.toLocaleString(),
            detail: '基于任务输入与引用证据文本估算'
          },
          {
            label: '估算 Completion Tokens',
            value: runtime.usageAnalytics.totalEstimatedCompletionTokens.toLocaleString(),
            detail: '基于结果、trace 与内部消息文本估算'
          },
          {
            label: '估算总 Tokens',
            value: runtime.usageAnalytics.totalEstimatedTokens.toLocaleString(),
            detail: `实测 ${runtime.usageAnalytics.measuredRunCount} runs / 估算 ${runtime.usageAnalytics.estimatedRunCount} runs`
          },
          {
            label: '估算费用',
            value: `¥${runtime.usageAnalytics.totalEstimatedCostCny.toFixed(2)}`,
            detail: `$${runtime.usageAnalytics.totalEstimatedCostUsd.toFixed(4)} / 基于内部模型费率映射`
          },
          {
            label: '真实/估算费用',
            value: `¥${runtime.usageAnalytics.providerMeasuredCostCny.toFixed(2)} / ¥${runtime.usageAnalytics.estimatedFallbackCostCny.toFixed(2)}`,
            detail: 'provider 实测 / fallback 估算'
          }
        ].map(card => (
          <Card key={card.label} className="rounded-3xl border-stone-200 bg-white shadow-sm">
            <CardContent className="p-6">
              <p className="text-sm text-stone-500">{card.label}</p>
              <p className="mt-4 text-3xl font-semibold tracking-tight text-stone-950">{card.value}</p>
              <p className="mt-3 text-sm text-stone-500">{card.detail}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="rounded-3xl border-stone-200 bg-white shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-semibold text-stone-950">Budget Policy & Alerts</CardTitle>
          <Badge variant="outline">{runtime.usageAnalytics.alerts.length}</Badge>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">
              日 token 阈值 {runtime.usageAnalytics.budgetPolicy.dailyTokenWarning.toLocaleString()}
            </Badge>
            <Badge variant="secondary">
              日费用阈值 ¥{runtime.usageAnalytics.budgetPolicy.dailyCostCnyWarning.toFixed(2)}
            </Badge>
            <Badge variant="secondary">
              累计费用阈值 ¥{runtime.usageAnalytics.budgetPolicy.totalCostCnyWarning.toFixed(2)}
            </Badge>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {runtime.usageAnalytics.alerts.map((alert, index) => (
              <article
                key={`${alert.title}-${index}`}
                className={`rounded-2xl border px-4 py-4 ${
                  alert.level === 'critical'
                    ? 'border-red-200 bg-red-50'
                    : alert.level === 'warning'
                      ? 'border-amber-200 bg-amber-50'
                      : 'border-emerald-200 bg-emerald-50'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-stone-950">{alert.title}</p>
                    <p className="mt-1 text-sm leading-6 text-stone-600">{alert.description}</p>
                  </div>
                  <Badge
                    variant={
                      alert.level === 'critical' ? 'destructive' : alert.level === 'warning' ? 'warning' : 'success'
                    }
                  >
                    {alert.level}
                  </Badge>
                </div>
              </article>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-3xl border-stone-200 bg-white shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-semibold text-stone-950">Governance Audit</CardTitle>
          <Badge variant="outline">{runtime.recentGovernanceAudit?.length ?? 0}</Badge>
        </CardHeader>
        <CardContent className="grid gap-3">
          {(runtime.recentGovernanceAudit?.length ?? 0) === 0 ? (
            <p className="text-sm text-stone-500">当前还没有治理动作审计记录。</p>
          ) : (
            runtime.recentGovernanceAudit?.map(item => (
              <article key={item.id} className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-stone-950">{item.action}</p>
                    <p className="mt-1 text-xs text-stone-500">
                      {item.scope} / {item.targetId} / {item.actor}
                    </p>
                  </div>
                  <Badge
                    variant={
                      item.outcome === 'success' ? 'success' : item.outcome === 'pending' ? 'warning' : 'destructive'
                    }
                  >
                    {item.outcome}
                  </Badge>
                </div>
                <p className="mt-2 text-xs text-stone-500">{new Date(item.at).toLocaleString()}</p>
                {item.reason ? <p className="mt-2 text-sm text-stone-600">{item.reason}</p> : null}
              </article>
            ))
          )}
        </CardContent>
      </Card>
    </>
  );
}
