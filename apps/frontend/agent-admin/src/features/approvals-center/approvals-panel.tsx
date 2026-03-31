import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  DashboardCenterShell,
  DashboardEmptyState,
  DashboardMetricGrid,
  DashboardToolbar
} from '@/components/dashboard-center-shell';

import type { ApprovalCenterItem } from '@/types/admin';
import { getExecutionModeDisplayName, getMinistryDisplayName, normalizeExecutionMode } from '@/lib/runtime-semantics';

interface ApprovalsPanelProps {
  approvals: ApprovalCenterItem[];
  loading: boolean;
  onExport: () => void;
  onCopyShareLink: () => void;
  executionModeFilter: 'all' | 'plan' | 'execute' | 'imperial_direct';
  onExecutionModeFilterChange: (value: 'all' | 'plan' | 'execute' | 'imperial_direct') => void;
  interactionKindFilter:
    | 'all'
    | 'approval'
    | 'plan-question'
    | 'supplemental-input'
    | 'revise-required'
    | 'micro-loop-exhausted'
    | 'mode-transition';
  onInteractionKindFilterChange: (
    value:
      | 'all'
      | 'approval'
      | 'plan-question'
      | 'supplemental-input'
      | 'revise-required'
      | 'micro-loop-exhausted'
      | 'mode-transition'
  ) => void;
  onDecision: (decision: 'approve' | 'reject', taskId: string, intent: string) => void;
}

function getReasonCodeLabel(reasonCode?: string) {
  switch (reasonCode) {
    case 'approved_by_policy':
      return '策略自动通过';
    case 'requires_approval_destructive':
      return '破坏性操作';
    case 'requires_approval_governance':
      return '治理/发布类动作';
    case 'requires_approval_missing_preview':
      return '缺少执行预览';
    case 'requires_approval_profile_override':
      return 'Profile 保守策略';
    case 'requires_approval_tool_policy':
      return '工具默认要求审批';
    default:
      return '';
  }
}

function getInterruptSourceLabel(source?: 'graph' | 'tool') {
  switch (source) {
    case 'graph':
      return '图内发起';
    case 'tool':
      return '工具内发起';
    default:
      return '';
  }
}

function getInterruptModeLabel(mode?: 'blocking' | 'non-blocking') {
  switch (mode) {
    case 'blocking':
      return '阻塞式';
    case 'non-blocking':
      return '非阻塞式';
    default:
      return '';
  }
}

function getResumeStrategyLabel(strategy?: 'command' | 'approval-recovery') {
  switch (strategy) {
    case 'command':
      return '图中断恢复';
    case 'approval-recovery':
      return '兼容恢复链路';
    default:
      return '';
  }
}

function getExecutionModeLabel(mode?: string) {
  return getExecutionModeDisplayName(mode) ?? '';
}

export function filterApprovals(
  approvals: ApprovalCenterItem[],
  filters: {
    executionMode: 'all' | 'plan' | 'execute' | 'imperial_direct';
    interactionKind:
      | 'all'
      | 'approval'
      | 'plan-question'
      | 'supplemental-input'
      | 'revise-required'
      | 'micro-loop-exhausted'
      | 'mode-transition';
  }
) {
  return approvals.filter(approval => {
    if (filters.executionMode !== 'all' && normalizeExecutionMode(approval.executionMode) !== filters.executionMode) {
      return false;
    }
    if (filters.interactionKind !== 'all' && approval.interactionKind !== filters.interactionKind) {
      return false;
    }
    return true;
  });
}

export function ApprovalsPanel({
  approvals,
  loading,
  onExport,
  onCopyShareLink,
  executionModeFilter,
  onExecutionModeFilterChange,
  interactionKindFilter,
  onInteractionKindFilterChange,
  onDecision
}: ApprovalsPanelProps) {
  const filteredApprovals = filterApprovals(approvals, {
    executionMode: executionModeFilter,
    interactionKind: interactionKindFilter
  });
  const planningReadonlyCount = approvals.filter(
    approval => normalizeExecutionMode(approval.executionMode) === 'plan'
  ).length;
  const executeCount = approvals.filter(
    approval => normalizeExecutionMode(approval.executionMode) === 'execute'
  ).length;
  const planQuestionCount = approvals.filter(approval => approval.interactionKind === 'plan-question').length;
  const operationApprovalCount = approvals.filter(
    approval => !approval.interactionKind || approval.interactionKind === 'approval'
  ).length;

  return (
    <DashboardCenterShell
      title="Approvals Center"
      description="统一处理高风险动作、计划问题和补充输入，不让审批流散落在不同视图里。"
      count={approvals.length}
      actions={
        <>
          <Button size="sm" variant="outline" onClick={onCopyShareLink}>
            复制视角链接
          </Button>
          <Button size="sm" variant="outline" onClick={onExport} disabled={loading}>
            导出 approvals
          </Button>
        </>
      }
    >
      <DashboardMetricGrid
        columns="md:grid-cols-2 xl:grid-cols-4"
        items={[
          { label: '全部审批', value: approvals.length, note: '当前挂起在司礼监的动作与问题' },
          { label: '计划模式', value: planningReadonlyCount, note: '只读规划阶段触发的人工交互' },
          { label: '执行模式', value: executeCount, note: '执行链中的高风险确认' },
          { label: '计划提问', value: planQuestionCount, note: '需要用户补充或批红的问题集' }
        ]}
      />
      <DashboardToolbar title="Filter Bar" description="按 execution mode 与 interaction kind 收窄当前审批视图。">
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">操作确认 {operationApprovalCount}</Badge>
          <Badge variant="outline">计划提问 {planQuestionCount}</Badge>
          <Badge variant="outline">计划模式 {planningReadonlyCount}</Badge>
          <Badge variant="outline">执行模式 {executeCount}</Badge>
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
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
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Interaction Kind</p>
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
      </DashboardToolbar>
      {approvals.length === 0 ? (
        <DashboardEmptyState message="当前没有待审批动作。" />
      ) : filteredApprovals.length === 0 ? (
        <DashboardEmptyState message="当前筛选条件下没有待处理交互中断。" />
      ) : (
        <div className="grid gap-4">
          {filteredApprovals.map(approval => (
            <Card
              key={`${approval.taskId}-${approval.intent}`}
              className="border-amber-200/70 bg-amber-50/60 shadow-sm"
            >
              <CardContent className="grid gap-4 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {approval.questionSetTitle ?? approval.intent}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">{approval.taskId}</p>
                  </div>
                  <Badge variant="warning">{approval.status}</Badge>
                </div>
                <p className="text-sm leading-6 text-foreground/80">{approval.goal}</p>
                <div className="flex flex-wrap gap-2">
                  {approval.executionMode ? (
                    <Badge variant="outline">{getExecutionModeLabel(approval.executionMode)}</Badge>
                  ) : null}
                  {approval.currentMinistry ? (
                    <Badge variant="secondary">
                      {getMinistryDisplayName(approval.currentMinistry) ?? approval.currentMinistry}
                    </Badge>
                  ) : null}
                  {approval.currentWorker ? <Badge variant="secondary">{approval.currentWorker}</Badge> : null}
                  {approval.sessionId ? <Badge variant="secondary">{approval.sessionId}</Badge> : null}
                  {approval.toolName ? <Badge variant="secondary">{approval.toolName}</Badge> : null}
                  {approval.riskLevel ? <Badge variant="secondary">risk {approval.riskLevel}</Badge> : null}
                  {approval.requestedBy ? (
                    <Badge variant="secondary">
                      {getMinistryDisplayName(approval.requestedBy) ?? approval.requestedBy}
                    </Badge>
                  ) : null}
                  {approval.reasonCode ? (
                    <Badge variant="outline">{getReasonCodeLabel(approval.reasonCode)}</Badge>
                  ) : null}
                  {approval.interruptSource ? (
                    <Badge variant="outline">{getInterruptSourceLabel(approval.interruptSource)}</Badge>
                  ) : null}
                  {approval.interruptMode ? (
                    <Badge variant="outline">{getInterruptModeLabel(approval.interruptMode)}</Badge>
                  ) : null}
                  {approval.resumeStrategy ? (
                    <Badge variant="outline">{getResumeStrategyLabel(approval.resumeStrategy)}</Badge>
                  ) : null}
                  {approval.interactionKind === 'plan-question' ? <Badge variant="outline">计划提问</Badge> : null}
                </div>
                <p className="text-xs text-muted-foreground">{approval.reason ?? '等待管理员决策。'}</p>
                {approval.preview?.length ? (
                  <div className="grid gap-2 rounded-2xl border border-border/70 bg-background/70 p-3">
                    {approval.preview.map(item => (
                      <div key={`${approval.taskId}:${item.label}:${item.value}`} className="grid gap-1">
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{item.label}</p>
                        <code className="rounded-lg bg-muted px-2 py-1 text-xs text-foreground">{item.value}</code>
                      </div>
                    ))}
                  </div>
                ) : null}
                <div className="flex gap-2">
                  <Button onClick={() => onDecision('approve', approval.taskId, approval.intent)} disabled={loading}>
                    {approval.interactionKind === 'plan-question' ? '按推荐继续' : '批准'}
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => onDecision('reject', approval.taskId, approval.intent)}
                    disabled={loading}
                  >
                    拒绝
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </DashboardCenterShell>
  );
}
