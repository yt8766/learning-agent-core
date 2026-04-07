import type { ChatMessageRecord } from '@/types/chat';

export function getIntentLabel(intent: string) {
  switch (intent) {
    case 'write_file':
      return '写入文件';
    case 'call_external_api':
      return '调用外部接口';
    case 'install_skill':
      return '安装技能';
    case 'read_file':
      return '读取文件';
    default:
      return intent;
  }
}

export function getRiskTagColor(riskLevel?: string) {
  if (riskLevel === 'high') {
    return 'red';
  }
  if (riskLevel === 'medium') {
    return 'orange';
  }
  return 'blue';
}

export function getRiskLabel(riskLevel?: string) {
  switch (riskLevel) {
    case 'high':
      return '高风险';
    case 'medium':
      return '中风险';
    case 'low':
      return '低风险';
    default:
      return '待补充风险信息';
  }
}

export function getApprovalDisplayStatusMeta(status?: 'pending' | 'allowed' | 'rejected' | 'rejected_with_feedback') {
  switch (status) {
    case 'allowed':
      return { color: 'green' as const, label: '已允许' };
    case 'rejected':
      return { color: 'red' as const, label: '已拒绝' };
    case 'rejected_with_feedback':
      return { color: 'orange' as const, label: '已拒绝并附说明' };
    default:
      return { color: 'processing' as const, label: '等待确认' };
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
    case 'requires_approval_external_mutation':
      return '涉及外部系统变更';
    case 'requires_approval_missing_preview':
      return '缺少执行预览';
    case 'requires_approval_permission_escalation':
      return '需要更高权限';
    case 'requires_approval_profile_override':
      return '当前 profile 保守策略';
    case 'requires_approval_high_risk':
      return '命中高危动作策略';
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

export function getCapabilityCatalogTagColor(kind: 'skill' | 'connector' | 'tool') {
  if (kind === 'skill') {
    return 'purple';
  }
  if (kind === 'connector') {
    return 'cyan';
  }
  return 'geekblue';
}

export function getPlanQuestionTypeLabel(type: 'direction' | 'detail' | 'tradeoff') {
  switch (type) {
    case 'direction':
      return '方向选择';
    case 'tradeoff':
      return '权衡取舍';
    default:
      return '细节补充';
  }
}

export type ApprovalRequestCardData = Extract<NonNullable<ChatMessageRecord['card']>, { type: 'approval_request' }>;
export type PlanQuestionCardData = Extract<NonNullable<ChatMessageRecord['card']>, { type: 'plan_question' }>;
