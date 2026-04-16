import { describe, expect, it } from 'vitest';

import {
  ApprovalRecord as CoreApprovalRecord,
  ApprovalRecordSchema as coreApprovalRecordSchema,
  TaskRecordSchema as coreTaskRecordSchema,
  buildApprovalScopeMatchKey as coreBuildApprovalScopeMatchKey,
  isCitationEvidenceSource as coreIsCitationEvidenceSource
} from '@agent/core';
import { ApprovalRecordSchema, TaskRecordSchema, buildApprovalScopeMatchKey, isCitationEvidenceSource } from '../src';
import type {
  ApprovalRecord,
  MemoryRecord,
  PlatformApprovalRecord,
  ReflectionResult,
  SharedPlatformConsoleRecord,
  TaskRecord
} from '../src';
import type {
  PlatformApprovalRecord as CorePlatformApprovalRecord,
  SharedPlatformConsoleRecord as CoreSharedPlatformConsoleRecord,
  TaskRecord as CoreTaskRecord
} from '@agent/core';

describe('@agent/shared core compat boundary', () => {
  it('re-exports core-backed runtime schemas and helpers without forking implementations', () => {
    expect(ApprovalRecordSchema).toBe(coreApprovalRecordSchema);
    expect(TaskRecordSchema).toBe(coreTaskRecordSchema);
    expect(buildApprovalScopeMatchKey).toBe(coreBuildApprovalScopeMatchKey);
    expect(isCitationEvidenceSource).toBe(coreIsCitationEvidenceSource);
  });

  it('keeps platform approval compat types assignable to the core host contract', () => {
    const approval: PlatformApprovalRecord = {
      taskId: 'task-1',
      goal: '确认导出边界',
      status: 'pending',
      approvals: []
    };
    const coreApproval: CorePlatformApprovalRecord = approval;

    expect(coreApproval.taskId).toBe('task-1');
  });

  it('keeps governance compat records assignable to the core host contract while preserving shared widening', () => {
    const approvalRecord: ApprovalRecord = {
      taskId: 'task-1',
      intent: 'write_file',
      decision: 'pending',
      decidedAt: '2026-04-16T00:00:00.000Z'
    };
    const coreApprovalRecord: CoreApprovalRecord = approvalRecord;

    expect(coreApprovalRecord.decision).toBe('pending');
  });

  it('keeps shared task records assignable to the core task host contract', () => {
    const task: TaskRecord = {
      id: 'task-1',
      goal: '收口 compat 导出',
      status: 'queued',
      trace: [],
      approvals: [],
      agentStates: [],
      messages: [],
      createdAt: '2026-04-16T00:00:00.000Z',
      updatedAt: '2026-04-16T00:00:00.000Z'
    };
    const coreTask: CoreTaskRecord = task;

    expect(coreTask.goal).toBe('收口 compat 导出');
  });

  it('keeps knowledge compat records mapped to core contracts while preserving shared-only composition types', () => {
    const memory: MemoryRecord = {
      id: 'memory-1',
      type: 'fact',
      summary: 'compat 边界已收口',
      content: 'shared 继续作为 compat 层',
      tags: ['compat'],
      createdAt: '2026-04-16T00:00:00.000Z',
      updatedAt: '2026-04-16T00:00:00.000Z'
    };
    const reflection: ReflectionResult = {
      whatWorked: ['core 作为主宿主'],
      whatFailed: ['shared 双主定义'],
      nextAttemptAdvice: ['继续保持 compat 收口'],
      memoryCandidate: memory
    };

    expect(reflection.memoryCandidate?.summary).toContain('compat');
  });

  it('keeps shared platform console wrappers assignable to the core generic contract', () => {
    const consoleRecord: SharedPlatformConsoleRecord = {
      runtime: undefined,
      approvals: [],
      learning: undefined,
      evals: undefined,
      skills: [],
      evidence: [],
      connectors: [],
      skillSources: undefined,
      companyAgents: [],
      rules: [],
      tasks: [],
      sessions: []
    };
    const coreConsoleRecord: CoreSharedPlatformConsoleRecord = consoleRecord;

    expect(coreConsoleRecord.runtime).toBeUndefined();
  });
});
