import { describe, expect, it, vi } from 'vitest';

import { ActionIntent, TaskStatus } from '@agent/core';

import {
  enforceInterruptControllerPolicy,
  finalizeLifecycleTaskState,
  buildSkillInstallPendingExecution
} from '../src/graphs/main/runtime/lifecycle/state/main-graph-lifecycle-persistence';

function makeTask(overrides: Record<string, unknown> = {}) {
  return {
    id: 'task-1',
    goal: 'test goal',
    trace: [],
    activeInterrupt: undefined,
    interruptHistory: undefined,
    partialAggregation: undefined,
    internalSubAgents: undefined,
    review: undefined,
    result: undefined,
    externalSources: [],
    pendingApproval: undefined,
    ...overrides
  } as any;
}

describe('main-graph-lifecycle-persistence (direct)', () => {
  describe('enforceInterruptControllerPolicy', () => {
    it('does nothing when no active interrupt', () => {
      const task = makeTask();
      const addTrace = vi.fn();
      enforceInterruptControllerPolicy({ task, addTrace });
      expect(addTrace).not.toHaveBeenCalled();
    });

    it('sets interruptOrigin from interrupt origin', () => {
      const task = makeTask({
        activeInterrupt: { id: 'int-1', status: 'pending', origin: 'runtime' }
      });
      enforceInterruptControllerPolicy({ task, addTrace: vi.fn() });
      expect(task.interruptOrigin).toBe('runtime');
    });

    it('cancels proxy user-input interrupt without counselor_proxy origin', () => {
      const task = makeTask({
        activeInterrupt: {
          id: 'int-1',
          status: 'pending',
          kind: 'user-input',
          proxySourceAgentId: 'agent-1',
          origin: 'runtime'
        }
      });
      const addTrace = vi.fn();
      enforceInterruptControllerPolicy({ task, addTrace });
      // After cancellation, activeInterrupt is set to undefined
      expect(task.activeInterrupt).toBeUndefined();
      // But the cancelled interrupt is added to history
      expect(task.interruptHistory).toBeDefined();
      expect(task.interruptHistory).toHaveLength(1);
      expect(task.interruptHistory[0].status).toBe('cancelled');
      expect(addTrace).toHaveBeenCalled();
    });

    it('does not cancel proxy user-input interrupt with counselor_proxy origin', () => {
      const task = makeTask({
        activeInterrupt: {
          id: 'int-1',
          status: 'pending',
          kind: 'user-input',
          proxySourceAgentId: 'agent-1',
          origin: 'counselor_proxy'
        }
      });
      enforceInterruptControllerPolicy({ task, addTrace: vi.fn() });
      expect(task.activeInterrupt.status).toBe('pending');
    });

    it('truncates questions to 3 for counselor_proxy with > 3 questions', () => {
      const questions = [{ q: '1' }, { q: '2' }, { q: '3' }, { q: '4' }];
      const task = makeTask({
        activeInterrupt: {
          id: 'int-1',
          status: 'pending',
          origin: 'counselor_proxy',
          payload: { questions }
        }
      });
      const addTrace = vi.fn();
      enforceInterruptControllerPolicy({ task, addTrace });
      expect(task.activeInterrupt.payload.questions).toHaveLength(3);
      expect(addTrace).toHaveBeenCalled();
    });

    it('does not truncate questions when <= 3', () => {
      const questions = [{ q: '1' }, { q: '2' }];
      const task = makeTask({
        activeInterrupt: {
          id: 'int-1',
          status: 'pending',
          origin: 'counselor_proxy',
          payload: { questions }
        }
      });
      const addTrace = vi.fn();
      enforceInterruptControllerPolicy({ task, addTrace });
      expect(task.activeInterrupt.payload.questions).toHaveLength(2);
    });
  });

  describe('finalizeLifecycleTaskState', () => {
    it('clears partialAggregation on completed task', () => {
      const task = makeTask({
        status: TaskStatus.COMPLETED,
        partialAggregation: { data: 'test' },
        internalSubAgents: [{ id: 'agent-1' }]
      });
      finalizeLifecycleTaskState(task);
      expect(task.partialAggregation).toBeUndefined();
      expect(task.internalSubAgents).toBeUndefined();
    });

    it('clears partialAggregation on failed task', () => {
      const task = makeTask({
        status: TaskStatus.FAILED,
        partialAggregation: { data: 'test' }
      });
      finalizeLifecycleTaskState(task);
      expect(task.partialAggregation).toBeUndefined();
    });

    it('clears partialAggregation on cancelled task', () => {
      const task = makeTask({
        status: TaskStatus.CANCELLED,
        partialAggregation: { data: 'test' }
      });
      finalizeLifecycleTaskState(task);
      expect(task.partialAggregation).toBeUndefined();
    });

    it('does not clear partialAggregation on running task', () => {
      const task = makeTask({
        status: TaskStatus.RUNNING,
        partialAggregation: { data: 'test' }
      });
      finalizeLifecycleTaskState(task);
      expect(task.partialAggregation).toEqual({ data: 'test' });
    });

    it('appends diagnosis evidence when review and result present', () => {
      const task = makeTask({
        goal: '请诊断任务 #1',
        review: { decision: 'pass', notes: [] },
        result: 'task completed'
      });
      finalizeLifecycleTaskState(task);
      expect(task.externalSources).toHaveLength(1);
      expect(task.externalSources[0].sourceType).toBe('diagnosis_result');
    });
  });

  describe('buildSkillInstallPendingExecution', () => {
    it('returns undefined when no pending approval', () => {
      const task = makeTask();
      expect(buildSkillInstallPendingExecution(task, 'goal')).toBeUndefined();
    });

    it('returns undefined when pending approval intent is not install_skill', () => {
      const task = makeTask({
        pendingApproval: { intent: ActionIntent.WRITE_FILE }
      });
      expect(buildSkillInstallPendingExecution(task, 'goal')).toBeUndefined();
    });

    it('returns pending execution for install_skill intent', () => {
      const task = makeTask({
        pendingApproval: { intent: ActionIntent.INSTALL_SKILL, toolName: 'npx skills add' },
        trace: [{ node: 'approval_gate', data: { receiptId: 'r1', skillDisplayName: 'My Skill' } }]
      });
      const result = buildSkillInstallPendingExecution(task, 'normalized goal');
      expect(result).toBeDefined();
      expect(result!.taskId).toBe('task-1');
      expect(result!.intent).toBe(ActionIntent.INSTALL_SKILL);
      expect(result!.toolName).toBe('npx skills add');
      expect(result!.kind).toBe('skill_install');
      expect(result!.goal).toBe('normalized goal');
    });

    it('extracts receiptId from approval_gate trace', () => {
      const task = makeTask({
        pendingApproval: { intent: ActionIntent.INSTALL_SKILL, toolName: 'npx skills add' },
        trace: [
          { node: 'other', data: {} },
          { node: 'approval_gate', data: { receiptId: 'receipt-123', skillDisplayName: 'Skill' } }
        ]
      });
      const result = buildSkillInstallPendingExecution(task, 'goal');
      expect(result!.receiptId).toBe('receipt-123');
    });

    it('returns undefined receiptId when no approval_gate trace', () => {
      const task = makeTask({
        pendingApproval: { intent: ActionIntent.INSTALL_SKILL, toolName: 'npx skills add' },
        trace: [{ node: 'other', data: {} }]
      });
      const result = buildSkillInstallPendingExecution(task, 'goal');
      expect(result!.receiptId).toBeUndefined();
    });
  });
});
