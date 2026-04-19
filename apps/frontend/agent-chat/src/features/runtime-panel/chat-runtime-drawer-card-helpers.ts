import type { ChatCheckpointRecord } from '@/types/chat';

import { getMinistryLabel } from './chat-runtime-drawer-helpers';

export function getExecutionStepStatusColor(status?: string) {
  switch (status) {
    case 'completed':
      return 'success';
    case 'blocked':
      return 'error';
    case 'running':
      return 'info';
    default:
      return 'info';
  }
}

export function getExecutionStepOwnerLabel(owner?: string) {
  switch (owner) {
    case 'session':
      return '会话层';
    case 'libu':
      return '吏部';
    case 'hubu':
      return '户部';
    case 'gongbu':
      return '工部';
    case 'bingbu':
      return '兵部';
    case 'xingbu':
      return '刑部';
    case 'libu-docs':
      return '礼部';
    case 'system':
      return '系统';
    default:
      return owner ?? '--';
  }
}

export interface WorkflowAlertDescriptor {
  key: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  description: string;
}

export function getWorkflowAlertDescriptors(
  checkpoint?: ChatCheckpointRecord,
  routeReason?: string
): WorkflowAlertDescriptor[] {
  const alerts: WorkflowAlertDescriptor[] = [];

  if (routeReason) {
    alerts.push({
      key: 'route-reason',
      type: 'info',
      title: checkpoint?.specialistLead?.domain === 'general-assistant' ? '通用助理兜底原因' : '专家路由依据',
      description: routeReason
    });
  }

  if (checkpoint?.dispatches?.length) {
    const selectedAgents = Array.from(
      new Set(checkpoint.dispatches.map(item => item.selectedAgentId).filter((item): item is string => Boolean(item)))
    );
    alerts.push({
      key: 'dispatches',
      type: 'info',
      title: '票拟分发纪律',
      description: `本轮共记录 ${checkpoint.dispatches.length} 条分发：${
        checkpoint.contextFilterState?.dispatchOrder?.join(' -> ') ??
        Array.from(new Set(checkpoint.dispatches.map(item => item.kind))).join(' / ')
      }${selectedAgents.length ? `；已收敛 Agent ${selectedAgents.join(' / ')}` : ''}。`
    });
  }

  if (checkpoint?.contextFilterState?.audienceSlices) {
    alerts.push({
      key: 'audience-slices',
      type: 'info',
      title: '文书科受众切片',
      description: `群辅 ${checkpoint.contextFilterState.audienceSlices.strategy.dispatchCount} / 六部 ${checkpoint.contextFilterState.audienceSlices.ministry.dispatchCount} / 通才 ${checkpoint.contextFilterState.audienceSlices.fallback.dispatchCount}`
    });
  }

  if (checkpoint?.streamStatus) {
    alerts.push({
      key: 'stream-status',
      type: 'info',
      title: `当前节点：${checkpoint.streamStatus.nodeLabel ?? checkpoint.streamStatus.nodeId ?? '处理中'}`,
      description: `${checkpoint.streamStatus.detail ?? '暂无节点明细'}${
        typeof checkpoint.streamStatus.progressPercent === 'number'
          ? `（${checkpoint.streamStatus.progressPercent}%）`
          : ''
      }`
    });
  }

  if (checkpoint?.budgetGateState) {
    alerts.push({
      key: 'budget-gate',
      type: checkpoint.budgetGateState.status === 'open' ? 'success' : 'warning',
      title: `预算门：${checkpoint.budgetGateState.status}`,
      description: `${checkpoint.budgetGateState.summary}${
        typeof checkpoint.budgetGateState.queueDepth === 'number'
          ? `（queue ${checkpoint.budgetGateState.queueDepth}）`
          : ''
      }`
    });
  }

  if (checkpoint?.complexTaskPlan) {
    alerts.push({
      key: 'complex-task-plan',
      type: 'info',
      title: `复杂任务拆解：${checkpoint.complexTaskPlan.status}`,
      description: `${checkpoint.complexTaskPlan.summary}（subGoals ${checkpoint.complexTaskPlan.subGoals.length}）`
    });
  }

  if (checkpoint?.blackboardState) {
    alerts.push({
      key: 'blackboard-state',
      type: 'info',
      title: '全局态视图',
      description: `trace ${checkpoint.blackboardState.refs.traceCount} / evidence ${checkpoint.blackboardState.refs.evidenceCount} / scopes ${checkpoint.blackboardState.visibleScopes.join(' / ')}`
    });
  }

  if (checkpoint?.finalReviewState) {
    alerts.push({
      key: 'final-review-state',
      type: checkpoint.finalReviewState.decision === 'pass' ? 'success' : 'warning',
      title: `终审链：${checkpoint.finalReviewState.decision}`,
      description: `${checkpoint.finalReviewState.summary}${
        checkpoint.finalReviewState.deliveryStatus
          ? `；礼部交付 ${checkpoint.finalReviewState.deliveryStatus}${
              checkpoint.finalReviewState.deliveryMinistry
                ? `（${getMinistryLabel(checkpoint.finalReviewState.deliveryMinistry)}）`
                : ''
            }`
          : ''
      }`
    });
  }

  if (checkpoint?.critiqueResult) {
    alerts.push({
      key: 'critique-result',
      type:
        checkpoint.critiqueResult.decision === 'pass'
          ? 'success'
          : checkpoint.critiqueResult.decision === 'needs_human_approval'
            ? 'warning'
            : 'error',
      title: `刑部结论：${checkpoint.critiqueResult.decision}`,
      description: `${checkpoint.critiqueResult.summary}（修订 ${checkpoint?.graphState?.revisionCount ?? 0} / ${
        checkpoint?.graphState?.maxRevisions ?? 0
      }）${checkpoint.critiqueResult.shouldBlockEarly ? '；建议前置阻断。' : ''}`
    });
  }

  if (checkpoint?.criticState) {
    alerts.push({
      key: 'critic-state',
      type: checkpoint.criticState.decision === 'pass_through' ? 'success' : 'warning',
      title: `批判层：${checkpoint.criticState.decision}`,
      description: checkpoint.criticState.summary
    });
  }

  if (checkpoint?.guardrailState) {
    alerts.push({
      key: 'guardrail-state',
      type: checkpoint.guardrailState.verdict === 'pass_through' ? 'success' : 'warning',
      title: `护栏：${checkpoint.guardrailState.stage} / ${checkpoint.guardrailState.verdict}`,
      description: checkpoint.guardrailState.summary
    });
  }

  if (checkpoint?.governanceScore) {
    alerts.push({
      key: 'governance-score',
      type:
        checkpoint.governanceScore.status === 'healthy'
          ? 'success'
          : checkpoint.governanceScore.status === 'watch'
            ? 'warning'
            : 'error',
      title: `吏部评分：${checkpoint.governanceScore.score} / ${checkpoint.governanceScore.status}`,
      description: `${checkpoint.governanceScore.summary}（信任调整 ${checkpoint.governanceScore.trustAdjustment}）`
    });
  }

  if (checkpoint?.governanceReport) {
    alerts.push({
      key: 'governance-report',
      type: 'info',
      title: '治理报告摘要',
      description: `${checkpoint.governanceReport.reviewOutcome.summary}；证据 ${checkpoint.governanceReport.evidenceSufficiency.score}；sandbox ${checkpoint.governanceReport.sandboxReliability.score}`
    });
  }

  if (checkpoint?.graphState?.microLoopState) {
    alerts.push({
      key: 'micro-loop-state',
      type: checkpoint.graphState.microLoopState.state === 'exhausted' ? 'error' : 'info',
      title: `工兵微循环：${checkpoint.graphState.microLoopState.state}`,
      description: `当前轮次 ${checkpoint.graphState.microLoopState.attempt} / ${checkpoint.graphState.microLoopState.maxAttempts}${
        checkpoint.graphState.microLoopState.exhaustedReason
          ? `；熔断原因 ${checkpoint.graphState.microLoopState.exhaustedReason}`
          : ''
      }`
    });
  }

  if (checkpoint?.sandboxState) {
    alerts.push({
      key: 'sandbox-state',
      type:
        checkpoint.sandboxState.status === 'passed'
          ? 'success'
          : checkpoint.sandboxState.status === 'failed'
            ? 'error'
            : 'info',
      title: `演武场：${checkpoint.sandboxState.stage} / ${checkpoint.sandboxState.status}`,
      description: `attempt ${checkpoint.sandboxState.attempt} / ${checkpoint.sandboxState.maxAttempts}${
        checkpoint.sandboxState.verdict ? `；verdict ${checkpoint.sandboxState.verdict}` : ''
      }${checkpoint.sandboxState.exhaustedReason ? `；${checkpoint.sandboxState.exhaustedReason}` : ''}`
    });
  }

  if (checkpoint?.knowledgeIngestionState || checkpoint?.knowledgeIndexState) {
    alerts.push({
      key: 'knowledge-state',
      type: 'info',
      title: '藏经阁摘要',
      description: `ingestion ${checkpoint?.knowledgeIngestionState?.status ?? 'idle'} / index ${
        checkpoint?.knowledgeIndexState?.indexStatus ?? 'building'
      } / searchable ${checkpoint?.knowledgeIndexState?.searchableDocumentCount ?? 0} / blocked ${
        checkpoint?.knowledgeIndexState?.blockedDocumentCount ?? 0
      }`
    });
  }

  if (checkpoint?.approvalFeedback) {
    alerts.push({
      key: 'approval-feedback',
      type: 'error',
      title: '最近一次批注',
      description: checkpoint.approvalFeedback
    });
  }

  return alerts;
}
