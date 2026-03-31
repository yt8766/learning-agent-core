import type { ApprovalRecord, ChatCheckpointRecord } from '@/types/chat';
import {
  getExecutionModeDisplayName,
  getMinistryDisplayName,
  isLegacyExecutionModeAlias,
  normalizeExecutionMode
} from '@/lib/runtime-semantics';

export function getApprovalRiskLabel(riskLevel?: string) {
  switch (riskLevel) {
    case 'high':
      return '高风险';
    case 'medium':
      return '中风险';
    case 'low':
      return '低风险';
    default:
      return '风险信息待补充';
  }
}

export function getApprovalReasonLabel(reasonCode?: string) {
  switch (reasonCode) {
    case 'approved_by_policy':
      return '策略自动通过';
    case 'requires_approval_destructive':
      return '检测到破坏性操作';
    case 'requires_approval_governance':
      return '治理或发布类动作';
    case 'requires_approval_missing_preview':
      return '缺少执行预览';
    case 'requires_approval_profile_override':
      return '当前策略较保守';
    case 'requires_approval_tool_policy':
      return '工具默认要求审批';
    default:
      return '';
  }
}

export function getApprovalSummaryCopy(approval: ApprovalRecord) {
  if (approval.reason?.trim()) {
    return approval.reason.trim();
  }

  return '请在聊天记录中的审批卡片里确认。';
}

export function getInterruptSourceLabel(source?: 'graph' | 'tool') {
  switch (source) {
    case 'graph':
      return '图内发起';
    case 'tool':
      return '工具内发起';
    default:
      return '运行时发起';
  }
}

export function getInterruptModeLabel(mode?: 'blocking' | 'non-blocking') {
  switch (mode) {
    case 'blocking':
      return '阻塞式';
    case 'non-blocking':
      return '非阻塞式';
    default:
      return '待确认';
  }
}

export function getResumeStrategyLabel(strategy?: 'command' | 'approval-recovery') {
  switch (strategy) {
    case 'command':
      return '图中断恢复';
    case 'approval-recovery':
      return '兼容恢复链路';
    default:
      return '待确认';
  }
}

export type InterruptInteractionKind = 'approval' | 'plan-question' | 'supplemental-input';

export function getInterruptInteractionKind(checkpoint?: ChatCheckpointRecord): InterruptInteractionKind | undefined {
  const payload = checkpoint?.activeInterrupt?.payload;
  if (
    payload &&
    typeof payload === 'object' &&
    typeof (payload as { interactionKind?: unknown }).interactionKind === 'string'
  ) {
    return (payload as { interactionKind: InterruptInteractionKind }).interactionKind;
  }
  if (checkpoint?.activeInterrupt?.kind === 'user-input') {
    return 'plan-question';
  }
  if (checkpoint?.activeInterrupt || checkpoint?.pendingApproval) {
    return 'approval';
  }
  return undefined;
}

export function getInterruptInteractionKindLabel(kind?: InterruptInteractionKind) {
  switch (kind) {
    case 'plan-question':
      return '计划提问';
    case 'supplemental-input':
      return '补充输入';
    case 'approval':
      return '操作确认';
    default:
      return '--';
  }
}

export function getInterruptQuestionSetTitle(checkpoint?: ChatCheckpointRecord) {
  const payload = checkpoint?.activeInterrupt?.payload;
  if (
    payload &&
    typeof payload === 'object' &&
    typeof (payload as { questionSet?: { title?: unknown } }).questionSet?.title === 'string'
  ) {
    return (payload as { questionSet: { title: string } }).questionSet.title;
  }
  return checkpoint?.planDraft?.questionSet?.title ?? '--';
}

export function getPendingApprovalStatusCopy(checkpoint?: ChatCheckpointRecord) {
  if (!checkpoint?.pendingApproval && !checkpoint?.activeInterrupt) {
    return '无待审批动作';
  }

  if (checkpoint.activeInterrupt) {
    return `${checkpoint.activeInterrupt.toolName || checkpoint.activeInterrupt.intent || checkpoint.activeInterrupt.kind} · ${getApprovalRiskLabel(checkpoint.activeInterrupt.riskLevel)} · ${getResumeStrategyLabel(checkpoint.activeInterrupt.resumeStrategy)} · ${getInterruptSourceLabel(checkpoint.activeInterrupt.source)} · ${getInterruptModeLabel(checkpoint.activeInterrupt.mode)}`;
  }

  return `${checkpoint.pendingApproval!.toolName || checkpoint.pendingApproval!.intent} · ${getApprovalRiskLabel(checkpoint.pendingApproval!.riskLevel)}`;
}

export function getInterruptStatusSummary(checkpoint?: ChatCheckpointRecord) {
  const kind = getInterruptInteractionKind(checkpoint);
  if (!kind) {
    return '无待处理中断';
  }
  if (kind === 'plan-question') {
    return `${getInterruptInteractionKindLabel(kind)} · ${getInterruptQuestionSetTitle(checkpoint)} · ${getResumeStrategyLabel(checkpoint?.activeInterrupt?.resumeStrategy)}`;
  }
  return `${getInterruptInteractionKindLabel(kind)} · ${getPendingApprovalStatusCopy(checkpoint)}`;
}

export function getRuntimeDrawerExportFilters(checkpoint?: ChatCheckpointRecord) {
  const executionMode = normalizeExecutionMode(checkpoint?.executionMode);
  const interactionKind = getInterruptInteractionKind(checkpoint);
  return {
    executionMode,
    interactionKind
  } as {
    executionMode?: 'plan' | 'execute' | 'imperial_direct';
    interactionKind: InterruptInteractionKind;
  };
}

export function getRuntimeDrawerExportScopeCopy(checkpoint?: ChatCheckpointRecord) {
  const filters = getRuntimeDrawerExportFilters(checkpoint);
  return `导出会沿用当前运行视角。执行边界：${
    filters.executionMode ? getExecutionModeLabel(filters.executionMode) : '全部'
  }，交互类型：${getInterruptInteractionKindLabel(filters.interactionKind)}。复制分享链接时也会沿用这组条件。`;
}

export function getMinistryLabel(ministry?: string) {
  return getMinistryDisplayName(ministry) ?? ministry ?? '未分派';
}

export function getWorkerLabel(workerId: string | undefined, getAgentLabel: (role?: string) => string) {
  if (!workerId) {
    return '系统正在分派中';
  }

  return getAgentLabel(workerId) || workerId;
}

export function getModelFallbackCopy(selectedModel?: string, defaultModel?: string) {
  if (!defaultModel) {
    return '--';
  }

  if (!selectedModel || selectedModel === defaultModel) {
    return '与当前模型一致';
  }

  return defaultModel;
}

export function getAgentStateTagColor(status?: string) {
  switch (status) {
    case 'completed':
      return 'success';
    case 'running':
      return 'processing';
    case 'failed':
      return 'error';
    default:
      return 'default';
  }
}

export function getAgentStateLabel(status?: string) {
  switch (status) {
    case 'completed':
      return '已完成';
    case 'running':
      return '处理中';
    case 'failed':
      return '异常';
    case 'queued':
      return '排队中';
    case 'waiting_approval':
      return '待确认';
    case 'cancelled':
      return '已取消';
    case 'blocked':
      return '已阻塞';
    default:
      return '待处理';
  }
}

export function formatRouteConfidence(confidence?: number) {
  if (typeof confidence !== 'number') {
    return '--';
  }
  if (confidence >= 0.8) {
    return `${Math.round(confidence * 100)}%（高）`;
  }
  if (confidence >= 0.5) {
    return `${Math.round(confidence * 100)}%（中）`;
  }
  return `${Math.round(confidence * 100)}%（低，已启用通用兜底）`;
}

export function buildRouteReason(checkpoint?: ChatCheckpointRecord) {
  const reason = checkpoint?.specialistLead?.reason?.trim();
  if (!checkpoint?.specialistLead) {
    return undefined;
  }
  if (checkpoint.specialistLead.domain === 'general-assistant') {
    return reason
      ? `当前问题领域边界不够明确，已回退到通用助理兜底。${reason}`
      : '当前问题领域边界不够明确，已回退到通用助理兜底。';
  }
  return reason;
}

export function getExecutionModeLabel(
  mode?: 'standard' | 'planning-readonly' | 'plan' | 'execute' | 'imperial_direct'
) {
  return getExecutionModeDisplayName(mode) ?? '--';
}

export function getExecutionModeSummary(checkpoint?: ChatCheckpointRecord) {
  const executionMode = normalizeExecutionMode(checkpoint?.executionMode);
  if (executionMode === 'imperial_direct') {
    return '当前处于皇帝直批快通道，已跳过大部分前置票拟，但危险能力仍会保留审批底线。';
  }
  if (executionMode !== 'plan') {
    return '当前不限制常规执行能力。';
  }

  const budget = checkpoint?.planDraft?.microBudget;
  const budgetText = budget
    ? `只读预算 ${budget.readOnlyToolsUsed}/${budget.readOnlyToolLimit}${budget.budgetTriggered ? '，已触顶' : ''}。`
    : '';
  return `当前处于计划模式，只允许仓库内与受控来源研究；open-web、浏览器、终端和写入类工具已禁用。${budgetText}`;
}

export function getLegacyModeNote(checkpoint?: ChatCheckpointRecord) {
  return checkpoint?.executionMode && isLegacyExecutionModeAlias(checkpoint.executionMode)
    ? `兼容旧模式：${checkpoint.executionMode}`
    : undefined;
}
