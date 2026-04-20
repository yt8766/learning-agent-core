import { useMemo } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { DashboardEmptyState } from '@/components/dashboard-center-shell';

import type { RuntimeCenterRecord } from '@/types/admin';

export {
  getExecutionModeLabel,
  getInteractionKindLabel,
  getRuntimeGovernanceReasonLabel,
  toRuntimeInterruptItems,
  filterRuntimeInterruptItems
} from './runtime-summary-tools-helpers';
export type { InterruptInteractionKind, RuntimeInterruptViewItem } from './runtime-summary-tools-helpers';

import type { InterruptInteractionKind } from './runtime-summary-tools-helpers';
import {
  getExecutionModeLabel,
  getInteractionKindLabel,
  toRuntimeInterruptItems,
  filterRuntimeInterruptItems
} from './runtime-summary-tools-helpers';

export function RuntimeSummaryTools({
  runtime,
  executionModeFilter,
  onExecutionModeFilterChange,
  interactionKindFilter,
  onInteractionKindFilterChange,
  onCopyShareLink
}: {
  runtime: RuntimeCenterRecord;
  executionModeFilter: 'all' | 'plan' | 'execute' | 'imperial_direct';
  onExecutionModeFilterChange: (value: 'all' | 'plan' | 'execute' | 'imperial_direct') => void;
  interactionKindFilter: 'all' | InterruptInteractionKind;
  onInteractionKindFilterChange: (value: 'all' | InterruptInteractionKind) => void;
  onCopyShareLink: () => void;
}) {
  const tools = runtime.tools;
  const interruptItems = useMemo(() => toRuntimeInterruptItems(runtime), [runtime]);
  const filteredInterruptItems = useMemo(
    () =>
      filterRuntimeInterruptItems(interruptItems, {
        executionMode: executionModeFilter,
        interactionKind: interactionKindFilter
      }),
    [interruptItems, executionModeFilter, interactionKindFilter]
  );
  const planningReadonlyCount = interruptItems.filter(item => item.executionMode === 'plan').length;
  const executeCount = interruptItems.filter(item => item.executionMode === 'execute').length;
  const planQuestionCount = interruptItems.filter(item => item.interactionKind === 'plan-question').length;
  const operationApprovalCount = interruptItems.filter(item => item.interactionKind === 'approval').length;
  const runtimeGovernanceCount = interruptItems.filter(item => item.isRuntimeGovernance).length;

  return (
    <Card className="rounded-[28px] border-border/70 bg-card/90 shadow-sm">
      <CardContent className="space-y-5 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Tool Governance</p>
            <h3 className="mt-2 text-xl font-semibold text-foreground">工具目录、选路与阻塞</h3>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              按 family、治理类型和最近使用情况观察当前 runtime 能力边界。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">总数 {tools?.totalTools ?? 0}</Badge>
            <Badge variant="outline">family {tools?.familyCount ?? 0}</Badge>
            <Badge variant="warning">阻塞 {tools?.blockedToolCount ?? 0}</Badge>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-3xl border border-border/70 bg-muted/30 p-4">
            <p className="text-sm font-semibold text-foreground">治理摘要</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge variant="outline">审批敏感 {tools?.approvalRequiredCount ?? 0}</Badge>
              <Badge variant="outline">MCP {tools?.mcpBackedCount ?? 0}</Badge>
              <Badge variant="outline">governance {tools?.governanceToolCount ?? 0}</Badge>
            </div>
          </div>
          <div className="rounded-3xl border border-border/70 bg-muted/30 p-4 lg:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-semibold text-foreground">Tool Families</p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">计划模式 {planningReadonlyCount}</Badge>
                <Badge variant="outline">执行模式 {executeCount}</Badge>
                <Badge variant="outline">计划提问 {planQuestionCount}</Badge>
                <Badge variant="outline">操作确认 {operationApprovalCount}</Badge>
                <Badge variant="warning">运行时治理 {runtimeGovernanceCount}</Badge>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {(tools?.families ?? []).map(family => (
                <span key={family.id}>
                  <Badge variant="secondary">
                    {family.displayName} · {family.toolCount}
                  </Badge>
                </span>
              ))}
              {!(tools?.families ?? []).length ? <DashboardEmptyState message="当前没有 tool family 统计。" /> : null}
            </div>
          </div>
        </div>

        <div className="grid gap-4 rounded-3xl border border-border/70 bg-muted/30 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">司礼监中断与模式筛选</p>
              <p className="mt-1 text-xs text-muted-foreground">
                直接筛出卡在计划模式或操作确认中的任务，恢复入口统一经过司礼监。
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{filteredInterruptItems.length}</Badge>
              <Button size="sm" variant="outline" onClick={onCopyShareLink}>
                复制视角链接
              </Button>
            </div>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="grid gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Execution Mode</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant={executionModeFilter === 'all' ? 'default' : 'outline'}
                  onClick={() => onExecutionModeFilterChange('all')}
                >
                  全部
                </Button>
                <Button
                  size="sm"
                  variant={executionModeFilter === 'plan' ? 'default' : 'outline'}
                  onClick={() => onExecutionModeFilterChange('plan')}
                >
                  计划模式
                </Button>
                <Button
                  size="sm"
                  variant={executionModeFilter === 'execute' ? 'default' : 'outline'}
                  onClick={() => onExecutionModeFilterChange('execute')}
                >
                  执行模式
                </Button>
              </div>
            </div>
            <div className="grid gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                Interaction Kind
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant={interactionKindFilter === 'all' ? 'default' : 'outline'}
                  onClick={() => onInteractionKindFilterChange('all')}
                >
                  全部
                </Button>
                <Button
                  size="sm"
                  variant={interactionKindFilter === 'plan-question' ? 'default' : 'outline'}
                  onClick={() => onInteractionKindFilterChange('plan-question')}
                >
                  计划提问
                </Button>
                <Button
                  size="sm"
                  variant={interactionKindFilter === 'approval' ? 'default' : 'outline'}
                  onClick={() => onInteractionKindFilterChange('approval')}
                >
                  操作确认
                </Button>
                <Button
                  size="sm"
                  variant={interactionKindFilter === 'supplemental-input' ? 'default' : 'outline'}
                  onClick={() => onInteractionKindFilterChange('supplemental-input')}
                >
                  补充输入
                </Button>
              </div>
            </div>
          </div>
          <div className="grid gap-3 xl:grid-cols-2">
            {filteredInterruptItems.slice(0, 8).map(item => (
              <div
                key={`${item.taskId}:${item.updatedAt}`}
                className="rounded-2xl border border-border/70 bg-background p-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant={
                      item.interactionKind === 'plan-question'
                        ? 'secondary'
                        : item.isRuntimeGovernance
                          ? 'warning'
                          : 'warning'
                    }
                  >
                    {getInteractionKindLabel(item.interactionKind)}
                  </Badge>
                  {item.isRuntimeGovernance ? <Badge variant="warning">runtime-governance</Badge> : null}
                  {item.isWatchdog ? <Badge variant="outline">watchdog</Badge> : null}
                  <Badge variant="outline">{getExecutionModeLabel(item.executionMode)}</Badge>
                  <Badge variant="outline">{item.status}</Badge>
                </div>
                <p className="mt-2 text-sm font-semibold text-foreground">{item.interruptLabel}</p>
                {item.reasonLabel ? <p className="mt-1 text-xs text-muted-foreground">{item.reasonLabel}</p> : null}
                <p className="mt-1 text-sm text-muted-foreground">{item.goal}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {item.taskId}
                  {item.currentMinistry ? ` · ${item.currentMinistry}` : ''}
                  {item.currentWorker ? ` · ${item.currentWorker}` : ''}
                </p>
              </div>
            ))}
            {!filteredInterruptItems.length ? (
              <DashboardEmptyState className="lg:col-span-2" message="当前筛选条件下没有匹配的交互中断任务。" />
            ) : null}
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <div className="rounded-3xl border border-border/70 bg-muted/30 p-4">
            <p className="text-sm font-semibold text-foreground">最近工具选路</p>
            <div className="mt-3 grid gap-3">
              {(tools?.recentUsage ?? []).slice(0, 8).map(item => (
                <div
                  key={`${item.toolName}:${item.usedAt}:${item.status}`}
                  className="rounded-2xl border border-border/70 bg-background p-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{item.family}</Badge>
                    <Badge variant={item.status === 'blocked' ? 'warning' : 'secondary'}>{item.status}</Badge>
                    <Badge variant="outline">{item.route}</Badge>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-foreground">{item.toolName}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {item.requestedBy ?? 'runtime'} · {new Date(item.usedAt).toLocaleString()}
                  </p>
                  {item.reason || item.blockedReason ? (
                    <p className="mt-2 text-sm text-muted-foreground">{item.blockedReason ?? item.reason}</p>
                  ) : null}
                </div>
              ))}
              {!(tools?.recentUsage ?? []).length ? <DashboardEmptyState message="当前还没有工具使用记录。" /> : null}
            </div>
          </div>

          <div className="rounded-3xl border border-border/70 bg-muted/30 p-4">
            <p className="text-sm font-semibold text-foreground">当前阻塞原因</p>
            <div className="mt-3 grid gap-3">
              {(tools?.blockedReasons ?? []).slice(0, 8).map(item => (
                <div
                  key={`${item.toolName}:${item.usedAt}`}
                  className="rounded-2xl border border-amber-200/70 bg-amber-50/80 p-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="warning">{item.toolName}</Badge>
                    {item.riskLevel ? <Badge variant="outline">{item.riskLevel}</Badge> : null}
                  </div>
                  <p className="mt-2 text-sm text-amber-950">
                    {item.blockedReason ?? item.reason ?? '等待补充阻塞原因'}
                  </p>
                </div>
              ))}
              {!(tools?.blockedReasons ?? []).length ? (
                <DashboardEmptyState message="当前没有 tool governance 阻塞。" />
              ) : null}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
