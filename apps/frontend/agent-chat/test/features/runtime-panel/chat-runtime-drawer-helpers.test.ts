import { describe, expect, it } from 'vitest';

import {
  buildRouteReason,
  formatRouteConfidence,
  getAgentStateLabel,
  getAgentStateTagColor,
  getApprovalReasonLabel,
  getApprovalRiskLabel,
  getApprovalSummaryCopy,
  getExecutionModeSummary,
  getInterruptInteractionKind,
  getInterruptInteractionKindLabel,
  getInterruptModeLabel,
  getInterruptQuestionSetTitle,
  getInterruptSourceLabel,
  getLegacyModeNote,
  getMinistryLabel,
  getModelFallbackCopy,
  getPendingApprovalStatusCopy,
  getResumeStrategyLabel,
  getRuntimeDrawerExportFilters,
  getRuntimeDrawerExportScopeCopy,
  getWorkerLabel
} from '@/features/runtime-panel/chat-runtime-drawer-helpers';

describe('chat-runtime-drawer-helpers', () => {
  it('formats approval, interrupt, and agent state labels', () => {
    expect(getApprovalRiskLabel('high')).toBe('高风险');
    expect(getApprovalRiskLabel('medium')).toBe('中风险');
    expect(getApprovalRiskLabel('low')).toBe('低风险');
    expect(getApprovalRiskLabel()).toBe('风险信息待补充');

    expect(getApprovalReasonLabel('approved_by_policy')).toBe('策略自动通过');
    expect(getApprovalReasonLabel('watchdog_timeout')).toBe('运行时超时阻塞');
    expect(getApprovalReasonLabel('runtime_governance_gate')).toBe('运行时治理闸门');
    expect(getApprovalReasonLabel('unknown')).toBe('');

    expect(getApprovalSummaryCopy({ reason: '  请确认  ' } as any)).toBe('请确认');
    expect(getApprovalSummaryCopy({} as any)).toContain('审批卡片');

    expect(getInterruptSourceLabel('graph')).toBe('图内发起');
    expect(getInterruptSourceLabel('tool')).toBe('工具内发起');
    expect(getInterruptSourceLabel()).toBe('运行时发起');

    expect(getInterruptModeLabel('blocking')).toBe('阻塞式');
    expect(getInterruptModeLabel('non-blocking')).toBe('非阻塞式');
    expect(getInterruptModeLabel()).toBe('待确认');

    expect(getResumeStrategyLabel('command')).toBe('图中断恢复');
    expect(getResumeStrategyLabel('approval-recovery')).toBe('兼容恢复链路');
    expect(getResumeStrategyLabel()).toBe('待确认');

    expect(getInterruptInteractionKindLabel('plan-question')).toBe('计划提问');
    expect(getInterruptInteractionKindLabel('supplemental-input')).toBe('补充输入');
    expect(getInterruptInteractionKindLabel('approval')).toBe('操作确认');
    expect(getInterruptInteractionKindLabel()).toBe('--');

    expect(getAgentStateTagColor('completed')).toBe('success');
    expect(getAgentStateTagColor('running')).toBe('processing');
    expect(getAgentStateTagColor('failed')).toBe('error');
    expect(getAgentStateTagColor()).toBe('default');

    expect(getAgentStateLabel('completed')).toBe('已完成');
    expect(getAgentStateLabel('waiting_approval')).toBe('待确认');
    expect(getAgentStateLabel('blocked')).toBe('已阻塞');
    expect(getAgentStateLabel()).toBe('待处理');
  });

  it('builds interrupt summaries and export filters for plan, approval, and watchdog flows', () => {
    const approvalCheckpoint = {
      executionMode: 'execute',
      pendingApproval: {
        toolName: 'github-mcp',
        riskLevel: 'medium'
      }
    } as any;

    expect(getInterruptInteractionKind(approvalCheckpoint)).toBe('approval');
    expect(getPendingApprovalStatusCopy(approvalCheckpoint)).toContain('github-mcp');
    expect(getRuntimeDrawerExportFilters(approvalCheckpoint)).toEqual({
      executionMode: 'execute',
      interactionKind: 'approval'
    });

    const planQuestionCheckpoint = {
      executionMode: 'planning-readonly',
      activeInterrupt: {
        kind: 'user-input',
        resumeStrategy: 'command',
        payload: {
          questionSet: {
            title: '补充计划问题'
          }
        }
      },
      planDraft: {
        questionSet: {
          title: '备用标题'
        },
        microBudget: {
          readOnlyToolsUsed: 2,
          readOnlyToolLimit: 3,
          budgetTriggered: true
        }
      }
    } as any;

    expect(getInterruptInteractionKind(planQuestionCheckpoint)).toBe('plan-question');
    expect(getInterruptQuestionSetTitle(planQuestionCheckpoint)).toBe('补充计划问题');
    expect(getExecutionModeSummary(planQuestionCheckpoint)).toContain('只读预算 2/3，已触顶');
    expect(getRuntimeDrawerExportScopeCopy(planQuestionCheckpoint)).toContain('计划提问');
    expect(getRuntimeDrawerExportScopeCopy(planQuestionCheckpoint)).toContain('计划模式');

    const watchdogCheckpoint = {
      activeInterrupt: {
        kind: 'runtime-governance',
        toolName: 'run_terminal',
        intent: 'run_terminal',
        riskLevel: 'high',
        resumeStrategy: 'approval-recovery',
        source: 'tool',
        mode: 'blocking',
        payload: {
          watchdog: true,
          interactionKind: 'supplemental-input',
          runtimeGovernanceReasonCode: 'watchdog_timeout'
        }
      }
    } as any;

    expect(getInterruptInteractionKind(watchdogCheckpoint)).toBe('supplemental-input');
    expect(getPendingApprovalStatusCopy(watchdogCheckpoint)).toContain('兵部运行时阻塞');
    expect(getPendingApprovalStatusCopy(watchdogCheckpoint)).toContain('运行时超时阻塞');
  });

  it('formats route, mode, and worker level helpers', () => {
    expect(formatRouteConfidence()).toBe('--');
    expect(formatRouteConfidence(0.82)).toBe('82%（高）');
    expect(formatRouteConfidence(0.56)).toBe('56%（中）');
    expect(formatRouteConfidence(0.2)).toContain('低');

    expect(
      buildRouteReason({
        specialistLead: {
          domain: 'general-assistant',
          reason: '  当前缺少明确领域信号。 '
        }
      } as any)
    ).toContain('当前缺少明确领域信号');
    expect(
      buildRouteReason({
        specialistLead: {
          domain: 'gongbu-code',
          reason: '代码改动意图明确'
        }
      } as any)
    ).toBe('代码改动意图明确');
    expect(buildRouteReason()).toBeUndefined();

    expect(getExecutionModeSummary({ executionMode: 'imperial_direct' } as any)).toContain('皇帝直批快通道');
    expect(getExecutionModeSummary({ executionMode: 'execute' } as any)).toContain('不限制常规执行能力');

    expect(getLegacyModeNote({ executionMode: 'planning-readonly' } as any)).toContain('planning-readonly');
    expect(getLegacyModeNote({ executionMode: 'plan' } as any)).toBeUndefined();

    expect(getMinistryLabel('gongbu-code')).toBeTruthy();
    expect(getMinistryLabel()).toBe('未分派');
    expect(getWorkerLabel(undefined, role => role ?? '--')).toBe('系统正在分派中');
    expect(getWorkerLabel('worker-gongbu', () => '')).toBe('worker-gongbu');

    expect(getModelFallbackCopy(undefined, undefined)).toBe('--');
    expect(getModelFallbackCopy('gpt-5.4', 'gpt-5.4')).toBe('与当前模型一致');
    expect(getModelFallbackCopy('gpt-5.4', 'gpt-4.1')).toBe('gpt-4.1');
  });
});
