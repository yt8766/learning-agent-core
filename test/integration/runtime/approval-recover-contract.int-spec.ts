/**
 * approval -> recover integration
 *
 * 验证审批挂起、决策、恢复（recover）链路的契约边界是否仍正确。
 * 本文件是第 10 节"推荐优先补齐的六类测试"中第 4 类的骨架样例。
 *
 * 测试策略：
 * - 通过 @agent/core 的公开 schema 验证 approval / recover DTO 契约
 * - 通过 @agent/core 的 matchesApprovalScopePolicy 验证自动审批策略匹配逻辑
 * - 验证 TaskStatus 枚举值稳定性（runtime 跨包依赖此枚举做状态判断）
 * - 不依赖外部服务，不模拟 LLM 调用
 *
 * 扩展方向（后续按需补充）：
 * - SessionCoordinator.approveTask / rejectTask 端到端状态迁移（需 mock repository）
 * - checkpoint 持久化后 recover 的跨包协作链路
 * - interrupt -> reject_with_feedback -> recover 链路状态机
 */

import { describe, it, expect } from 'vitest';
import {
  // approval action contract
  SessionApprovalDtoSchema,
  ApprovalActionDtoSchema,
  // recover contract
  RecoverToCheckpointDtoSchema,
  // approval scope policy
  ApprovalScopePolicyRecordSchema,
  matchesApprovalScopePolicy,
  buildApprovalScopeMatchKey,
  // runtime status enum (consumed by runtime session coordinator)
  TaskStatus,
  // approval decision enum
  ApprovalDecision
} from '@agent/core';

// ─── 1. ApprovalAction DTO contract ───────────────────────────────────────────

describe('approval contract: ApprovalActionDto schema', () => {
  it('parses a minimal approval action (no required fields)', () => {
    const result = ApprovalActionDtoSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('parses a full approval action with all optional fields', () => {
    const result = ApprovalActionDtoSchema.safeParse({
      intent: 'execute shell command',
      reason: 'reviewed and approved',
      actor: 'human-reviewer',
      feedback: 'ok to proceed',
      // action enum: 'approve' | 'reject' | 'feedback' | 'input' | 'bypass' | 'abort'
      interrupt: { action: 'approve' }
    });
    expect(result.success).toBe(true);
  });
});

// ─── 2. SessionApproval DTO contract ──────────────────────────────────────────

describe('approval contract: SessionApprovalDto schema', () => {
  it('parses a minimal session approval with required sessionId', () => {
    const result = SessionApprovalDtoSchema.safeParse({ sessionId: 'sess-001' });
    expect(result.success).toBe(true);
  });

  it('parses a full session approval with scope', () => {
    const result = SessionApprovalDtoSchema.safeParse({
      sessionId: 'sess-001',
      intent: 'deploy to production',
      actor: 'admin',
      approvalScope: 'session'
    });
    expect(result.success).toBe(true);
  });

  it('rejects a session approval missing sessionId', () => {
    const result = SessionApprovalDtoSchema.safeParse({ actor: 'admin' });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid approvalScope value', () => {
    const result = SessionApprovalDtoSchema.safeParse({
      sessionId: 'sess-001',
      approvalScope: 'invalid-scope'
    });
    expect(result.success).toBe(false);
  });
});

// ─── 3. RecoverToCheckpoint DTO contract ──────────────────────────────────────

describe('recover contract: RecoverToCheckpointDto schema', () => {
  it('parses a minimal recover DTO with required sessionId', () => {
    const result = RecoverToCheckpointDtoSchema.safeParse({ sessionId: 'sess-001' });
    expect(result.success).toBe(true);
  });

  it('parses a recover DTO with checkpointId and reason', () => {
    const result = RecoverToCheckpointDtoSchema.safeParse({
      sessionId: 'sess-001',
      checkpointId: 'ckpt-abc123',
      reason: 'user requested rollback after rejection'
    });
    expect(result.success).toBe(true);
  });

  it('parses a recover DTO with checkpointCursor', () => {
    const result = RecoverToCheckpointDtoSchema.safeParse({
      sessionId: 'sess-001',
      checkpointCursor: 3
    });
    expect(result.success).toBe(true);
  });

  it('rejects a recover DTO missing sessionId', () => {
    const result = RecoverToCheckpointDtoSchema.safeParse({ checkpointId: 'ckpt-abc' });
    expect(result.success).toBe(false);
  });
});

// ─── 4. TaskStatus 枚举稳定性（runtime session coordinator 跨包依赖） ──────────

describe('approval state machine: TaskStatus enum stability', () => {
  it('WAITING_APPROVAL status value is stable', () => {
    expect(TaskStatus.WAITING_APPROVAL).toBe('waiting_approval');
  });

  it('CANCELLED status value is stable', () => {
    expect(TaskStatus.CANCELLED).toBe('cancelled');
  });

  it('COMPLETED status value is stable', () => {
    expect(TaskStatus.COMPLETED).toBe('completed');
  });

  it('approval state machine sequence is representable', () => {
    // 验证状态机转换路径在类型层面可表达
    // RUNNING -> WAITING_APPROVAL -> (approved) -> RUNNING -> COMPLETED
    // RUNNING -> WAITING_APPROVAL -> (rejected) -> CANCELLED
    const sequence = [
      TaskStatus.RUNNING,
      TaskStatus.WAITING_APPROVAL,
      ApprovalDecision.APPROVED,
      TaskStatus.RUNNING,
      TaskStatus.COMPLETED
    ];
    expect(sequence).toHaveLength(5);
    expect(sequence[2]).toBe('approved');
  });
});

// ─── 5. 自动审批策略匹配（matchesApprovalScopePolicy） ────────────────────────

describe('approval scope policy: matchesApprovalScopePolicy', () => {
  const input = {
    intent: 'execute shell command',
    toolName: 'bash',
    riskCode: 'FS_WRITE',
    requestedBy: 'supervisor-agent'
  };
  const matchKey = buildApprovalScopeMatchKey(input);

  const activePolicy = {
    status: 'active' as const,
    matchKey
  };

  const revokedPolicy = {
    status: 'revoked' as const,
    matchKey
  };

  const wrongKeyPolicy = {
    status: 'active' as const,
    matchKey: 'other-intent::other-tool::::'
  };

  it('matches an active policy with the same key', () => {
    expect(matchesApprovalScopePolicy(activePolicy, input)).toBe(true);
  });

  it('does not match a revoked policy', () => {
    expect(matchesApprovalScopePolicy(revokedPolicy, input)).toBe(false);
  });

  it('does not match an active policy with a different key', () => {
    expect(matchesApprovalScopePolicy(wrongKeyPolicy, input)).toBe(false);
  });

  it('buildApprovalScopeMatchKey is deterministic', () => {
    expect(buildApprovalScopeMatchKey(input)).toBe(buildApprovalScopeMatchKey(input));
  });

  it('buildApprovalScopeMatchKey normalizes whitespace in intent', () => {
    const a = buildApprovalScopeMatchKey({ intent: 'execute  shell  command', toolName: 'bash' });
    const b = buildApprovalScopeMatchKey({ intent: 'execute shell command', toolName: 'bash' });
    expect(a).toBe(b);
  });
});

// ─── 6. ApprovalScopePolicyRecord schema ──────────────────────────────────────

describe('approval scope policy: ApprovalScopePolicyRecord schema', () => {
  const validPolicy = {
    id: 'policy-001',
    scope: 'session' as const,
    status: 'active' as const,
    matchKey: buildApprovalScopeMatchKey({ intent: 'deploy', toolName: 'deploy-tool' }),
    actor: 'admin',
    // createdAt and updatedAt are required fields
    createdAt: '2026-04-22T00:00:00.000Z',
    updatedAt: '2026-04-22T00:00:00.000Z'
  };

  it('parses a valid ApprovalScopePolicyRecord', () => {
    const result = ApprovalScopePolicyRecordSchema.safeParse(validPolicy);
    expect(result.success).toBe(true);
  });

  it('rejects a policy with invalid scope', () => {
    const result = ApprovalScopePolicyRecordSchema.safeParse({
      ...validPolicy,
      scope: 'workspace' // not in enum
    });
    expect(result.success).toBe(false);
  });

  it('rejects a policy with invalid status', () => {
    const result = ApprovalScopePolicyRecordSchema.safeParse({
      ...validPolicy,
      status: 'pending' // not in enum
    });
    expect(result.success).toBe(false);
  });
});
