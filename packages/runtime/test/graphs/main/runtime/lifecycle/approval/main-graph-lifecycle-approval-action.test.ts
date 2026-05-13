import { describe, expect, it, vi, beforeEach } from 'vitest';

import { ActionIntent, ApprovalDecision, TaskStatus } from '@agent/core';

import { applyApprovalAction } from '../../../../../../src/graphs/main/runtime/lifecycle/approval/main-graph-lifecycle-approval-action';

function makeTask(overrides: Record<string, unknown> = {}): any {
  return {
    id: 'task-1',
    status: TaskStatus.WAITING_APPROVAL,
    goal: 'test goal',
    context: undefined,
    approvals: [],
    interruptHistory: [],
    trace: [],
    activeInterrupt: {
      id: 'interrupt-1',
      status: 'pending',
      resumeStrategy: undefined,
      blockedReason: 'needs approval',
      reason: 'skill install',
      payload: undefined
    },
    pendingApproval: {
      toolName: 'test-tool',
      reason: 'needs approval',
      intent: ActionIntent.INSTALL_SKILL,
      riskLevel: 'medium'
    },
    pendingAction: undefined,
    result: undefined,
    approvalFeedback: undefined,
    review: undefined,
    updatedAt: '2026-05-10T00:00:00.000Z',
    ...overrides
  };
}

function makeParams(taskOverrides: Record<string, unknown> = {}) {
  const task = makeTask(taskOverrides);
  const tasks = new Map([['task-1', task]]);
  return {
    params: {
      tasks,
      runtime: {
        attachTool: vi.fn(),
        recordToolUsage: vi.fn()
      },
      transitionQueueState: vi.fn(),
      addTrace: vi.fn(),
      addProgressDelta: vi.fn(),
      setSubTaskStatus: vi.fn(),
      persistAndEmitTask: vi.fn().mockResolvedValue(undefined),
      pendingExecutions: new Map(),
      getSkillInstallApprovalResolver: vi.fn(() => undefined),
      runBootstrapGraph: vi.fn().mockResolvedValue(undefined),
      runTaskPipeline: vi.fn().mockResolvedValue(undefined),
      runApprovalRecoveryPipeline: vi.fn().mockResolvedValue(undefined)
    },
    task
  };
}

describe('applyApprovalAction', () => {
  describe('task not found', () => {
    it('returns undefined when task not in map', async () => {
      const { params } = makeParams();
      params.tasks.clear();
      const result = await applyApprovalAction(
        params as any,
        'task-1',
        {
          intent: 'test',
          reason: 'test'
        } as any,
        ApprovalDecision.APPROVED
      );
      expect(result).toBeUndefined();
    });
  });

  describe('command resume strategy', () => {
    it('persists task and runs bootstrap graph for pre_execution stage', async () => {
      const { params, task } = makeParams({
        activeInterrupt: {
          id: 'interrupt-1',
          status: 'pending',
          resumeStrategy: 'command',
          blockedReason: 'needs approval',
          reason: 'skill install',
          payload: { stage: 'pre_execution' }
        }
      });

      await applyApprovalAction(
        params as any,
        'task-1',
        { intent: ActionIntent.INSTALL_SKILL, reason: 'approve' } as any,
        ApprovalDecision.APPROVED
      );

      expect(params.persistAndEmitTask).toHaveBeenCalled();
      expect(params.runBootstrapGraph).toHaveBeenCalledWith(
        task,
        expect.objectContaining({ goal: 'test goal' }),
        expect.objectContaining({ mode: 'interrupt_resume' })
      );
    });

    it('runs task pipeline after bootstrap for pre_execution when not blocked', async () => {
      const { params, task } = makeParams({
        activeInterrupt: {
          id: 'interrupt-1',
          status: 'pending',
          resumeStrategy: 'command',
          blockedReason: 'needs approval',
          reason: 'skill install',
          payload: { stage: 'pre_execution' }
        }
      });
      task.status = TaskStatus.RUNNING;

      await applyApprovalAction(
        params as any,
        'task-1',
        { intent: ActionIntent.INSTALL_SKILL, reason: 'approve' } as any,
        ApprovalDecision.APPROVED
      );

      expect(params.runTaskPipeline).toHaveBeenCalledWith(task, expect.anything(), { mode: 'initial' });
    });

    it('skips task pipeline when bootstrap leaves task in waiting_approval', async () => {
      const { params, task } = makeParams({
        activeInterrupt: {
          id: 'interrupt-1',
          status: 'pending',
          resumeStrategy: 'command',
          blockedReason: 'needs approval',
          reason: 'skill install',
          payload: { stage: 'pre_execution' }
        }
      });
      task.status = TaskStatus.WAITING_APPROVAL;

      await applyApprovalAction(
        params as any,
        'task-1',
        { intent: ActionIntent.INSTALL_SKILL, reason: 'approve' } as any,
        ApprovalDecision.APPROVED
      );

      expect(params.runBootstrapGraph).toHaveBeenCalled();
      expect(params.runTaskPipeline).not.toHaveBeenCalled();
    });

    it('runs task pipeline with interrupt_resume for non-pre_execution stages', async () => {
      const { params, task } = makeParams({
        activeInterrupt: {
          id: 'interrupt-1',
          status: 'pending',
          resumeStrategy: 'command',
          blockedReason: 'needs approval',
          reason: 'execution',
          payload: { stage: 'research' }
        }
      });

      await applyApprovalAction(
        params as any,
        'task-1',
        { intent: ActionIntent.EXECUTE, reason: 'approve' } as any,
        ApprovalDecision.APPROVED
      );

      expect(params.runTaskPipeline).toHaveBeenCalledWith(
        task,
        expect.anything(),
        expect.objectContaining({ mode: 'interrupt_resume' })
      );
    });
  });

  describe('rejected decision', () => {
    it('sets task to BLOCKED on rejection', async () => {
      const { params, task } = makeParams();
      await applyApprovalAction(
        params as any,
        'task-1',
        { intent: ActionIntent.INSTALL_SKILL, reason: 'no', feedback: 'not allowed' } as any,
        ApprovalDecision.REJECTED
      );

      expect(task.status).toBe(TaskStatus.BLOCKED);
      expect(task.result).toContain('rejected');
      expect(task.approvalFeedback).toBe('not allowed');
    });

    it('cancels active interrupt on rejection', async () => {
      const { params, task } = makeParams();
      await applyApprovalAction(
        params as any,
        'task-1',
        { intent: ActionIntent.INSTALL_SKILL, feedback: 'denied' } as any,
        ApprovalDecision.REJECTED
      );

      expect(task.activeInterrupt.status).toBe('cancelled');
      expect(task.interruptHistory).toHaveLength(1);
      expect(task.interruptHistory[0].status).toBe('cancelled');
    });

    it('records tool usage as blocked on rejection', async () => {
      const { params } = makeParams();
      await applyApprovalAction(
        params as any,
        'task-1',
        { intent: ActionIntent.INSTALL_SKILL } as any,
        ApprovalDecision.REJECTED
      );

      expect(params.runtime.recordToolUsage).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ status: 'blocked' })
      );
    });

    it('uses activeInterrupt blockedReason as fallback when no feedback', async () => {
      const { params, task } = makeParams();
      await applyApprovalAction(
        params as any,
        'task-1',
        { intent: ActionIntent.INSTALL_SKILL } as any,
        ApprovalDecision.REJECTED
      );

      expect(task.activeInterrupt.blockedReason).toBe('needs approval');
    });
  });

  describe('approved decision', () => {
    it('resolves active interrupt on approval', async () => {
      const { params, task } = makeParams();
      await applyApprovalAction(
        params as any,
        'task-1',
        { intent: ActionIntent.INSTALL_SKILL } as any,
        ApprovalDecision.APPROVED
      );

      expect(task.activeInterrupt).toBeUndefined();
      expect(task.pendingApproval).toBeUndefined();
    });

    it('records tool usage as approved', async () => {
      const { params } = makeParams();
      await applyApprovalAction(
        params as any,
        'task-1',
        { intent: ActionIntent.INSTALL_SKILL } as any,
        ApprovalDecision.APPROVED
      );

      expect(params.runtime.recordToolUsage).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ status: 'approved' })
      );
    });

    it('sets status to RUNNING when no pending execution found', async () => {
      const { params, task } = makeParams();
      await applyApprovalAction(
        params as any,
        'task-1',
        { intent: ActionIntent.INSTALL_SKILL } as any,
        ApprovalDecision.APPROVED
      );

      expect(task.status).toBe(TaskStatus.RUNNING);
      expect(task.result).toContain('审批结果');
    });

    it('resolves skill install when pending is skill_install kind', async () => {
      const resolver = vi.fn().mockResolvedValue({
        skillSearch: { suggestions: [] },
        usedInstalledSkills: ['skill-1'],
        traceSummary: 'resolved'
      });
      const { params, task } = makeParams();
      params.pendingExecutions.set('task-1', {
        kind: 'skill_install',
        intent: ActionIntent.INSTALL_SKILL,
        toolName: 'test-tool',
        researchSummary: 'test',
        receiptId: 'receipt-1',
        goal: 'test goal'
      });
      params.getSkillInstallApprovalResolver = vi.fn(() => resolver);

      await applyApprovalAction(
        params as any,
        'task-1',
        { intent: ActionIntent.INSTALL_SKILL, actor: 'user-1' } as any,
        ApprovalDecision.APPROVED
      );

      expect(resolver).toHaveBeenCalledWith(expect.objectContaining({ actor: 'user-1' }));
      expect(task.status).toBe(TaskStatus.RUNNING);
      expect(params.runTaskPipeline).toHaveBeenCalled();
    });

    it('runs approval recovery pipeline for non-skill-install pending', async () => {
      const { params, task } = makeParams();
      params.pendingExecutions.set('task-1', {
        kind: 'tool_execution',
        intent: ActionIntent.EXECUTE,
        toolName: 'test-tool',
        researchSummary: 'test',
        receiptId: 'receipt-1',
        goal: 'test goal'
      });

      await applyApprovalAction(
        params as any,
        'task-1',
        { intent: ActionIntent.EXECUTE } as any,
        ApprovalDecision.APPROVED
      );

      expect(params.runApprovalRecoveryPipeline).toHaveBeenCalled();
    });
  });

  describe('intent resolution', () => {
    it('uses dto.intent when provided', async () => {
      const { params, task } = makeParams();
      await applyApprovalAction(params as any, 'task-1', { intent: 'custom_intent' } as any, ApprovalDecision.APPROVED);

      expect(task.approvals[0].intent).toBe('custom_intent');
    });

    it('falls back to pendingApproval.intent when dto.intent missing', async () => {
      const { params, task } = makeParams();
      await applyApprovalAction(params as any, 'task-1', { reason: 'test' } as any, ApprovalDecision.APPROVED);

      expect(task.approvals[0].intent).toBe(ActionIntent.INSTALL_SKILL);
    });

    it('falls back to interrupt when no other intent source', async () => {
      const { params, task } = makeParams({
        pendingApproval: undefined,
        pendingAction: undefined,
        activeInterrupt: {
          id: 'interrupt-1',
          status: 'pending',
          resumeStrategy: undefined,
          blockedReason: 'needs approval',
          reason: 'test',
          payload: undefined
        }
      });
      await applyApprovalAction(params as any, 'task-1', { reason: 'test' } as any, ApprovalDecision.APPROVED);

      expect(task.approvals[0].intent).toBe('interrupt');
    });
  });
});
