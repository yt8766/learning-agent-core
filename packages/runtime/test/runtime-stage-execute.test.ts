import { describe, expect, it, vi } from 'vitest';

import { ActionIntent, TaskStatus } from '@agent/core';

import { pauseExecutionForApproval } from '../src/flows/runtime-stage/runtime-stage-execute';

describe('runtime-stage-execute', () => {
  const makeCallbacks = () => ({
    transitionQueueState: vi.fn(),
    setSubTaskStatus: vi.fn(),
    addTrace: vi.fn(),
    addProgressDelta: vi.fn(),
    describeActionIntent: vi.fn().mockReturnValue('写入文件')
  });

  const makeTask = () =>
    ({
      id: 'task-1',
      status: TaskStatus.RUNNING,
      currentMinistry: 'gongbu-code',
      approvals: [],
      interruptHistory: []
    }) as any;

  describe('pauseExecutionForApproval', () => {
    it('sets task to waiting approval state', () => {
      const task = makeTask();
      const pendingExecutions = new Map();
      const callbacks = makeCallbacks();

      pauseExecutionForApproval({
        task,
        pendingExecutions,
        researchSummary: 'research done',
        execution: {
          intent: ActionIntent.WRITE_FILE,
          toolName: 'filesystem',
          summary: 'writing file'
        },
        callbacks
      });

      expect(task.status).toBe(TaskStatus.WAITING_APPROVAL);
      expect(task.currentNode).toBe('approval_gate');
      expect(task.pendingApproval).toBeDefined();
      expect(task.pendingApproval!.toolName).toBe('filesystem');
      expect(task.activeInterrupt).toBeDefined();
      expect(task.activeInterrupt!.status).toBe('pending');
      expect(task.approvals).toHaveLength(1);
      expect(task.approvals[0].decision).toBe('pending');
    });

    it('stores execution context in pendingExecutions map', () => {
      const task = makeTask();
      const pendingExecutions = new Map();
      const callbacks = makeCallbacks();

      pauseExecutionForApproval({
        task,
        pendingExecutions,
        researchSummary: 'research summary',
        execution: {
          intent: ActionIntent.WRITE_FILE,
          toolName: 'filesystem',
          summary: 'writing file',
          toolInput: { path: '/tmp/test' }
        },
        callbacks
      });

      expect(pendingExecutions.has('task-1')).toBe(true);
      const ctx = pendingExecutions.get('task-1');
      expect(ctx.toolName).toBe('filesystem');
      expect(ctx.researchSummary).toBe('research summary');
      expect(ctx.toolInput).toEqual({ path: '/tmp/test' });
    });

    it('handles watchdog timeout approval reason code', () => {
      const task = makeTask();
      const pendingExecutions = new Map();
      const callbacks = makeCallbacks();

      pauseExecutionForApproval({
        task,
        pendingExecutions,
        researchSummary: '',
        execution: {
          intent: ActionIntent.EXECUTE,
          toolName: 'sandbox',
          summary: 'sandbox running',
          approvalReasonCode: 'watchdog_timeout'
        },
        callbacks
      });

      expect(task.currentNode).toBe('runtime_governance_gate');
      expect(task.activeInterrupt!.source).toBe('tool');
      expect(task.activeInterrupt!.origin).toBe('timeout');
      expect(task.activeInterrupt!.kind).toBe('runtime-governance');
    });

    it('handles watchdog interaction required approval reason code', () => {
      const task = makeTask();
      const callbacks = makeCallbacks();

      pauseExecutionForApproval({
        task,
        pendingExecutions: new Map(),
        researchSummary: '',
        execution: {
          intent: ActionIntent.EXECUTE,
          toolName: 'sandbox',
          summary: 'running',
          approvalReasonCode: 'watchdog_interaction_required'
        },
        callbacks
      });

      expect(task.currentNode).toBe('runtime_governance_gate');
      expect(task.activeInterrupt!.kind).toBe('runtime-governance');
    });

    it('uses custom approval reason when provided', () => {
      const task = makeTask();
      const callbacks = makeCallbacks();

      pauseExecutionForApproval({
        task,
        pendingExecutions: new Map(),
        researchSummary: '',
        execution: {
          intent: ActionIntent.WRITE_FILE,
          toolName: 'fs',
          summary: 'writing',
          approvalReason: 'custom reason for approval'
        },
        callbacks
      });

      expect(task.pendingApproval!.reason).toBe('custom reason for approval');
    });

    it('adds interrupt to interrupt history', () => {
      const task = makeTask();
      const callbacks = makeCallbacks();

      pauseExecutionForApproval({
        task,
        pendingExecutions: new Map(),
        researchSummary: '',
        execution: {
          intent: ActionIntent.WRITE_FILE,
          toolName: 'fs',
          summary: 'writing'
        },
        callbacks
      });

      expect(task.interruptHistory).toHaveLength(1);
      expect(task.interruptHistory[0]).toBe(task.activeInterrupt);
    });

    it('calls transitionQueueState with waiting_approval', () => {
      const task = makeTask();
      const callbacks = makeCallbacks();

      pauseExecutionForApproval({
        task,
        pendingExecutions: new Map(),
        researchSummary: '',
        execution: {
          intent: ActionIntent.WRITE_FILE,
          toolName: 'fs',
          summary: 'writing'
        },
        callbacks
      });

      expect(callbacks.transitionQueueState).toHaveBeenCalledWith(task, 'waiting_approval');
    });

    it('sets executor subtask to blocked and reviewer to pending', () => {
      const task = makeTask();
      const callbacks = makeCallbacks();

      pauseExecutionForApproval({
        task,
        pendingExecutions: new Map(),
        researchSummary: '',
        execution: {
          intent: ActionIntent.WRITE_FILE,
          toolName: 'fs',
          summary: 'writing'
        },
        callbacks
      });

      expect(callbacks.setSubTaskStatus).toHaveBeenCalledWith(task, 'executor', 'blocked');
      expect(callbacks.setSubTaskStatus).toHaveBeenCalledWith(task, 'reviewer', 'pending');
    });
  });
});
