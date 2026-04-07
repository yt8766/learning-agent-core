import { describe, expect, it } from 'vitest';

import {
  getApprovalDisplayStatusMeta,
  getApprovalReasonLabel,
  getCapabilityCatalogTagColor,
  getIntentLabel,
  getInterruptModeLabel,
  getInterruptSourceLabel,
  getPlanQuestionTypeLabel,
  getResumeStrategyLabel,
  getRiskLabel,
  getRiskTagColor
} from '@/components/chat-message-cards/card-meta';

describe('card-meta helpers', () => {
  it('maps known action intents and falls back to the raw intent', () => {
    expect(getIntentLabel('write_file')).toBe('写入文件');
    expect(getIntentLabel('call_external_api')).toBe('调用外部接口');
    expect(getIntentLabel('install_skill')).toBe('安装技能');
    expect(getIntentLabel('read_file')).toBe('读取文件');
    expect(getIntentLabel('custom_intent')).toBe('custom_intent');
  });

  it('maps risk colors and labels with safe defaults', () => {
    expect(getRiskTagColor('high')).toBe('red');
    expect(getRiskTagColor('medium')).toBe('orange');
    expect(getRiskTagColor('low')).toBe('blue');
    expect(getRiskTagColor(undefined)).toBe('blue');

    expect(getRiskLabel('high')).toBe('高风险');
    expect(getRiskLabel('medium')).toBe('中风险');
    expect(getRiskLabel('low')).toBe('低风险');
    expect(getRiskLabel(undefined)).toBe('待补充风险信息');
  });

  it('maps approval statuses and reason codes', () => {
    expect(getApprovalDisplayStatusMeta('allowed')).toEqual({ color: 'green', label: '已允许' });
    expect(getApprovalDisplayStatusMeta('rejected')).toEqual({ color: 'red', label: '已拒绝' });
    expect(getApprovalDisplayStatusMeta('rejected_with_feedback')).toEqual({
      color: 'orange',
      label: '已拒绝并附说明'
    });
    expect(getApprovalDisplayStatusMeta('pending')).toEqual({ color: 'processing', label: '等待确认' });

    expect(getApprovalReasonLabel('approved_by_policy')).toBe('策略自动通过');
    expect(getApprovalReasonLabel('requires_approval_destructive')).toBe('检测到破坏性操作');
    expect(getApprovalReasonLabel('requires_approval_governance')).toBe('治理或发布类动作');
    expect(getApprovalReasonLabel('requires_approval_external_mutation')).toBe('涉及外部系统变更');
    expect(getApprovalReasonLabel('requires_approval_missing_preview')).toBe('缺少执行预览');
    expect(getApprovalReasonLabel('requires_approval_permission_escalation')).toBe('需要更高权限');
    expect(getApprovalReasonLabel('requires_approval_profile_override')).toBe('当前 profile 保守策略');
    expect(getApprovalReasonLabel('requires_approval_high_risk')).toBe('命中高危动作策略');
    expect(getApprovalReasonLabel('requires_approval_tool_policy')).toBe('工具默认要求审批');
    expect(getApprovalReasonLabel('watchdog_timeout')).toBe('运行时超时阻塞');
    expect(getApprovalReasonLabel('watchdog_interaction_required')).toBe('运行时等待补充输入');
    expect(getApprovalReasonLabel('runtime_governance_gate')).toBe('运行时治理闸门');
    expect(getApprovalReasonLabel('unknown')).toBe('');
  });

  it('maps interrupt and resume labels', () => {
    expect(getInterruptSourceLabel('graph')).toBe('图内发起');
    expect(getInterruptSourceLabel('tool')).toBe('工具内发起');
    expect(getInterruptSourceLabel(undefined)).toBe('运行时发起');

    expect(getInterruptModeLabel('blocking')).toBe('阻塞式');
    expect(getInterruptModeLabel('non-blocking')).toBe('非阻塞式');
    expect(getInterruptModeLabel(undefined)).toBe('待确认');

    expect(getResumeStrategyLabel('command')).toBe('图中断恢复');
    expect(getResumeStrategyLabel('approval-recovery')).toBe('兼容恢复链路');
    expect(getResumeStrategyLabel(undefined)).toBe('待确认');
  });

  it('maps capability catalog and plan question labels', () => {
    expect(getCapabilityCatalogTagColor('skill')).toBe('purple');
    expect(getCapabilityCatalogTagColor('connector')).toBe('cyan');
    expect(getCapabilityCatalogTagColor('tool')).toBe('geekblue');

    expect(getPlanQuestionTypeLabel('direction')).toBe('方向选择');
    expect(getPlanQuestionTypeLabel('tradeoff')).toBe('权衡取舍');
    expect(getPlanQuestionTypeLabel('detail')).toBe('细节补充');
  });
});
