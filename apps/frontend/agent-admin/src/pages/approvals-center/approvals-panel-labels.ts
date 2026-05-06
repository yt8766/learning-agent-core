import type { ApprovalCenterItem } from '@/types/admin';
import { getExecutionModeDisplayName } from '@/utils/runtime-semantics';

export function getReasonCodeLabel(reasonCode?: string) {
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
    case 'watchdog_timeout':
      return '运行时超时阻塞';
    case 'watchdog_interaction_required':
      return '运行时等待补充输入';
    case 'runtime_governance_gate':
      return '运行时治理闸门';
    default:
      return '';
  }
}

export function isRuntimeGovernanceApproval(approval: ApprovalCenterItem) {
  return approval.interactionKind === 'supplemental-input' && approval.reasonCode?.startsWith('watchdog_');
}

export function getInterruptSourceLabel(source?: 'graph' | 'tool') {
  switch (source) {
    case 'graph':
      return '图内发起';
    case 'tool':
      return '工具内发起';
    default:
      return '';
  }
}

export function getInterruptModeLabel(mode?: 'blocking' | 'non-blocking') {
  switch (mode) {
    case 'blocking':
      return '阻塞式';
    case 'non-blocking':
      return '非阻塞式';
    default:
      return '';
  }
}

export function getResumeStrategyLabel(strategy?: 'command' | 'approval-recovery') {
  switch (strategy) {
    case 'command':
      return '图中断恢复';
    case 'approval-recovery':
      return '兼容恢复链路';
    default:
      return '';
  }
}

export function getExecutionModeLabel(mode?: string) {
  return getExecutionModeDisplayName(mode) ?? '';
}
