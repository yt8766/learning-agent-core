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
  ChatRouteRecord,
  MemoryRecord,
  ModelRouteDecision,
  PlatformApprovalRecord,
  PendingApprovalRecord,
  PendingActionRecord,
  ReflectionResult,
  SharedPlatformConsoleRecord,
  TaskRecord,
  WorkflowPresetDefinition
} from '../src';
import type {
  PlatformApprovalRecord as CorePlatformApprovalRecord,
  ChatRouteRecord as CoreChatRouteRecord,
  ModelRouteDecision as CoreModelRouteDecision,
  PendingApprovalRecord as CorePendingApprovalRecord,
  PendingActionRecord as CorePendingActionRecord,
  SharedPlatformConsoleRecord as CoreSharedPlatformConsoleRecord,
  TaskRecord as CoreTaskRecord,
  WorkflowPresetDefinition as CoreWorkflowPresetDefinition
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

  it('keeps shared primitive compat aliases mapped to core host contracts', () => {
    const preset: WorkflowPresetDefinition = {
      id: 'workflow-1',
      displayName: 'Runtime Audit',
      intentPatterns: ['audit runtime'],
      requiredMinistries: ['gongbu-code'],
      allowedCapabilities: ['filesystem.read'],
      approvalPolicy: 'all-actions',
      outputContract: {
        type: 'markdown',
        requiredSections: ['summary']
      }
    };
    const route: ChatRouteRecord = {
      graph: 'workflow',
      flow: 'supervisor',
      reason: 'compat route',
      adapter: 'workflow-command',
      priority: 1
    };
    const modelRoute: ModelRouteDecision = {
      ministry: 'gongbu-code',
      workerId: 'worker-1',
      defaultModel: 'gpt-5.4',
      selectedModel: 'gpt-5.4',
      reason: 'default'
    };
    const pendingAction: PendingActionRecord = {
      toolName: 'filesystem.write',
      intent: 'write_file',
      requestedBy: 'gongbu-code'
    };
    const pendingApproval: PendingApprovalRecord = {
      ...pendingAction,
      reason: 'needs approval'
    };

    const corePreset: CoreWorkflowPresetDefinition = preset;
    const coreRoute: CoreChatRouteRecord = route;
    const coreModelRoute: CoreModelRouteDecision = modelRoute;
    const corePendingAction: CorePendingActionRecord = pendingAction;
    const corePendingApproval: CorePendingApprovalRecord = pendingApproval;

    expect(corePreset.id).toBe('workflow-1');
    expect(coreRoute.adapter).toBe('workflow-command');
    expect(coreModelRoute.selectedModel).toBe('gpt-5.4');
    expect(corePendingAction.toolName).toBe('filesystem.write');
    expect(corePendingApproval.reason).toBe('needs approval');
  });
});
