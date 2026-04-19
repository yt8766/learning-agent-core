import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DashboardEmptyState, DashboardMetricGrid } from '@/components/dashboard-center-shell';

import type { RuntimeSummarySectionProps } from './runtime-summary-types';

function getBudgetValue(budget: Record<string, unknown>, key: 'stepBudget' | 'retryBudget' | 'sourceBudget') {
  const value = budget[key];
  return typeof value === 'number' || typeof value === 'string' ? value : '--';
}

export function RuntimeSummaryOverview({
  runtime,
  onRevokeApprovalPolicy
}: Pick<RuntimeSummarySectionProps, 'runtime' | 'onRevokeApprovalPolicy'>) {
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
                ? '已有 diagnosis_result 可在证据中心复用'
                : '当前还没有形成可复用的诊断结果'
          },
          {
            label: '活跃尚书',
            value: runtime.activeMinistries.length,
            detail: runtime.activeWorkers.join(' / ') || '暂无'
          },
          {
            label: '当前节点战报',
            value: runtime.recentRuns?.[0]?.streamStatus?.nodeLabel ?? '暂无',
            detail:
              runtime.recentRuns?.[0]?.streamStatus?.detail ??
              runtime.recentRuns?.[0]?.contextFilterState?.filteredContextSlice?.summary ??
              '最近没有新的节点级流式状态'
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
            <Badge variant="secondary">步骤预算 {getBudgetValue(runtime.policy.budget, 'stepBudget')}</Badge>
            <Badge variant="secondary">重试预算 {getBudgetValue(runtime.policy.budget, 'retryBudget')}</Badge>
            <Badge variant="secondary">来源预算 {getBudgetValue(runtime.policy.budget, 'sourceBudget')}</Badge>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <RegistryCard
          title="Node Stream Monitor"
          count={runtime.streamMonitor?.length ?? 0}
          emptyText="当前还没有活跃节点流状态。"
          items={runtime.streamMonitor?.map(item => (
            <article key={item.taskId} className="rounded-2xl border border-border/70 bg-muted/30 px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">{item.currentNode ?? '当前节点'}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{item.taskId}</p>
                </div>
                {typeof item.progressPercent === 'number' ? (
                  <Badge variant="secondary">{item.progressPercent}%</Badge>
                ) : (
                  <Badge variant="outline">stream</Badge>
                )}
              </div>
              <p className="mt-3 text-sm text-foreground/80">{item.detail ?? item.goal}</p>
              <p className="mt-2 text-xs text-muted-foreground">{new Date(item.updatedAt).toLocaleString()}</p>
            </article>
          ))}
        />
        <RegistryCard
          title="Approval Scope Policies"
          count={runtime.approvalScopePolicies?.length ?? 0}
          emptyText="当前还没有持久化的高危审批策略。"
          items={runtime.approvalScopePolicies?.map(item => (
            <article key={item.id} className="rounded-2xl border border-border/70 bg-muted/30 px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">{item.toolName ?? item.intent ?? item.id}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{item.commandPreview ?? item.matchKey}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant={item.scope === 'always' ? 'warning' : 'secondary'}>{item.scope}</Badge>
                  <Badge variant="outline">命中 {item.matchCount ?? 0}</Badge>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {item.riskCode ? <Badge variant="outline">{item.riskCode}</Badge> : null}
                {item.requestedBy ? <Badge variant="outline">{item.requestedBy}</Badge> : null}
                {item.lastMatchedAt ? (
                  <Badge variant="outline">最近命中 {new Date(item.lastMatchedAt).toLocaleString()}</Badge>
                ) : null}
              </div>
              <div className="mt-3">
                <Button size="sm" variant="outline" onClick={() => onRevokeApprovalPolicy?.(item.id)}>
                  撤销策略
                </Button>
              </div>
            </article>
          ))}
        />
        <RegistryCard
          title="Daily Tech Briefing"
          count={runtime.dailyTechBriefing?.categories?.length ?? 0}
          emptyText="当前还没有每日技术情报推送记录。"
          items={
            runtime.dailyTechBriefing
              ? [
                  <article
                    key="daily-tech-briefing"
                    className="rounded-2xl border border-border/70 bg-muted/30 px-4 py-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          {runtime.dailyTechBriefing.enabled ? '已启用' : '未启用'}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {runtime.dailyTechBriefing.schedule}
                          {runtime.dailyTechBriefing.timezone ? ` / ${runtime.dailyTechBriefing.timezone}` : ''}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {runtime.dailyTechBriefing.scheduleValid === false
                            ? 'schedule 无效，未注册 Bree job'
                            : runtime.dailyTechBriefing.cron
                              ? `Bree cron: ${runtime.dailyTechBriefing.cron}`
                              : 'manual / 未注册 Bree job'}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge
                          variant={
                            runtime.dailyTechBriefing.scheduleValid === false
                              ? 'destructive'
                              : runtime.dailyTechBriefing.jobKey
                                ? 'success'
                                : 'outline'
                          }
                        >
                          {runtime.dailyTechBriefing.jobKey ? '已注册 Bree' : '未注册'}
                        </Badge>
                        {runtime.dailyTechBriefing.lastRunAt ? (
                          <Badge variant="secondary">
                            最近执行 {new Date(runtime.dailyTechBriefing.lastRunAt).toLocaleString()}
                          </Badge>
                        ) : (
                          <Badge variant="outline">尚未执行</Badge>
                        )}
                      </div>
                    </div>
                    {runtime.dailyTechBriefing.lastRegisteredAt ? (
                      <p className="mt-2 text-xs text-muted-foreground">
                        最近注册 {new Date(runtime.dailyTechBriefing.lastRegisteredAt).toLocaleString()}
                      </p>
                    ) : null}
                    <div className="mt-3 grid gap-2">
                      {runtime.dailyTechBriefing.categories.map(item => (
                        <div
                          key={item.category}
                          className="rounded-xl border border-border/70 bg-background/70 px-3 py-3 text-sm text-foreground/80"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge
                              variant={
                                item.status === 'failed'
                                  ? 'destructive'
                                  : item.status === 'sent'
                                    ? 'success'
                                    : 'outline'
                              }
                            >
                              {item.title}
                            </Badge>
                            <span>{item.status}</span>
                            <span>命中 {item.itemCount}</span>
                            {item.scheduleState ? (
                              <span>当前频率 {item.scheduleState.currentIntervalHours}h</span>
                            ) : null}
                            {item.scheduleState ? <span>回溯 {item.scheduleState.lookbackDays}d</span> : null}
                            {item.emptyDigest ? <span>空报</span> : null}
                            {item.error ? <span className="text-destructive">{item.error}</span> : null}
                          </div>
                          {item.scheduleState ? (
                            <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                              {item.scheduleState.lastRunAt ? (
                                <span>最近巡检 {new Date(item.scheduleState.lastRunAt).toLocaleString()}</span>
                              ) : null}
                              {item.scheduleState.nextRunAt ? (
                                <span>下次巡检 {new Date(item.scheduleState.nextRunAt).toLocaleString()}</span>
                              ) : null}
                              <span>热点连击 {item.scheduleState.consecutiveHotRuns}</span>
                              <span>空轮次 {item.scheduleState.consecutiveEmptyRuns}</span>
                              {item.scheduleState.lastAdaptiveReason ? (
                                <span>调频原因 {item.scheduleState.lastAdaptiveReason}</span>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </article>
                ]
              : undefined
          }
        />
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
