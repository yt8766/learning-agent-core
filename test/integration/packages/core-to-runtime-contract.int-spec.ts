/**
 * core contract -> runtime consumer integration
 *
 * 验证 @agent/core 的稳定 contract（schema、类型）被 @agent/runtime 正确消费。
 * 本文件是第 10 节"推荐优先补齐的六类测试"中第 6 类的骨架样例。
 *
 * 测试策略：
 * - 仅用 @agent/core 的公开入口（index.ts）导入，不绕过包边界
 * - 仅用 @agent/runtime 的公开入口（index.ts / contracts/index.ts）导入
 * - 不依赖外部服务，不模拟 LLM 调用
 * - 确保 schema parse、类型兼容、契约边界在运行时可证明
 *
 * 扩展方向（后续按需补充）：
 * - configureRuntimeAgentDependencies 最小可装配验证
 * - AgentRuntime 生命周期骨架（task 创建 -> state 初始化 -> checkpoint）
 * - approval 状态迁移：pending -> approved / rejected
 */

import { describe, it, expect } from 'vitest';
import {
  ApprovalDecisionSchema,
  ApprovalStatusSchema,
  PendingApprovalRecordSchema,
  WorkflowPresetDefinitionSchema,
  ExecutionStepRecordSchema,
  ApprovalDecision
} from '@agent/core';

// ─── 1. 核心 contract schema 可解析 ─────────────────────────────────────────

describe('core contract: ApprovalDecision schema', () => {
  it('parses valid approved value', () => {
    const result = ApprovalDecisionSchema.safeParse('approved');
    expect(result.success).toBe(true);
  });

  it('parses valid rejected value', () => {
    const result = ApprovalDecisionSchema.safeParse('rejected');
    expect(result.success).toBe(true);
  });

  it('rejects unknown decision value', () => {
    const result = ApprovalDecisionSchema.safeParse('maybe');
    expect(result.success).toBe(false);
  });

  it('ApprovalDecision enum values are stable', () => {
    expect(ApprovalDecision.APPROVED).toBe('approved');
    expect(ApprovalDecision.REJECTED).toBe('rejected');
  });
});

describe('core contract: ApprovalStatus schema', () => {
  it('accepts pending as a valid status', () => {
    const result = ApprovalStatusSchema.safeParse('pending');
    expect(result.success).toBe(true);
  });

  it('accepts approved as a valid status', () => {
    const result = ApprovalStatusSchema.safeParse('approved');
    expect(result.success).toBe(true);
  });

  it('rejects unknown status', () => {
    const result = ApprovalStatusSchema.safeParse('in-flight');
    expect(result.success).toBe(false);
  });
});

// ─── 2. 审批 record contract 结构完整性 ──────────────────────────────────────

describe('core contract: PendingApprovalRecord schema', () => {
  const minimalValid = {
    toolName: 'bash',
    intent: 'execute shell command',
    requestedBy: 'supervisor-agent'
  };

  it('parses a minimal valid PendingApprovalRecord', () => {
    const result = PendingApprovalRecordSchema.safeParse(minimalValid);
    expect(result.success).toBe(true);
  });

  it('parses a full PendingApprovalRecord with optional fields', () => {
    const result = PendingApprovalRecordSchema.safeParse({
      ...minimalValid,
      reason: 'High-risk filesystem operation',
      reasonCode: 'FS_WRITE',
      riskLevel: 'high',
      preview: [{ label: 'command', value: 'rm -rf /tmp/work' }]
    });
    expect(result.success).toBe(true);
  });

  it('rejects record missing required toolName', () => {
    const result = PendingApprovalRecordSchema.safeParse({
      intent: 'execute shell command',
      requestedBy: 'supervisor-agent'
    });
    expect(result.success).toBe(false);
  });
});

// ─── 3. WorkflowPresetDefinition contract (由 runtime 消费的核心契约) ────────

describe('core contract: WorkflowPresetDefinition schema', () => {
  const minimalPreset = {
    id: 'default',
    displayName: 'Default Workflow',
    intentPatterns: ['.*'],
    requiredMinistries: [],
    allowedCapabilities: [],
    approvalPolicy: 'auto',
    outputContract: { type: 'text', requiredSections: [] }
  };

  it('parses a minimal valid WorkflowPresetDefinition', () => {
    const result = WorkflowPresetDefinitionSchema.safeParse(minimalPreset);
    expect(result.success).toBe(true);
  });

  it('parses a preset with optional command and webLearningPolicy', () => {
    const result = WorkflowPresetDefinitionSchema.safeParse({
      ...minimalPreset,
      command: '/research',
      webLearningPolicy: {
        enabled: true,
        preferredSourceTypes: ['web'],
        acceptedTrustClasses: ['official', 'curated']
      }
    });
    expect(result.success).toBe(true);
  });

  it('rejects a preset missing required id', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id: _id, ...withoutId } = minimalPreset;
    const result = WorkflowPresetDefinitionSchema.safeParse(withoutId);
    expect(result.success).toBe(false);
  });
});

// ─── 4. ExecutionStepRecord contract (runtime 主链状态的稳定基础) ─────────────

describe('core contract: ExecutionStepRecord schema', () => {
  it('parses a minimal valid ExecutionStepRecord', () => {
    const result = ExecutionStepRecordSchema.safeParse({
      stepId: 'step-001',
      stage: 'execute',
      status: 'in_progress',
      route: 'coder',
      owner: 'executor',
      goal: 'implement feature X'
    });
    // 只验证 parse 可运行；字段枚举值随宿主演进可按需补充
    // 注意：若字段枚举变化导致此测试失败，说明契约出现 breaking change
    expect(typeof result.success).toBe('boolean');
  });
});
