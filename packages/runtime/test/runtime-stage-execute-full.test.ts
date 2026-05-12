import { describe, expect, it, vi } from 'vitest';

import { ActionIntent, AgentRole, TaskStatus } from '@agent/core';

import { pauseExecutionForApproval } from '../src/flows/runtime-stage/runtime-stage-execute';

function makeTask(overrides: Record<string, unknown> = {}) {
  return {
    id: 'task-1',
    status: TaskStatus.RUNNING,
    currentNode: 'execute',
    currentMinistry: 'gongbu-code',
    approvals: [],
    interruptHistory: [],
    ...overrides
  } as any;
}

function makeCallbacks() {
  return {
    transitionQueueState: vi.fn(),
    setSubTaskStatus: vi.fn(),
    addTrace: vi.fn(),
    addProgressDelta: vi.fn(),
    describeActionIntent: vi.fn().mockReturnValue('write file')
  };
}

describe('runtime-stage-execute', () => {
  describe('pauseExecutionForApproval', () => {
    it('sets task status to WAITING_APPROVAL', () => {
      const task = makeTask();
      const pendingExecutions = new Map();
      pauseExecutionForApproval({
        task,
        pendingExecutions,
        researchSummary: 'research done',
        execution: {
          intent: ActionIntent.WRITE_FILE,
          toolName: 'write_file',
          summary: 'writing file'
        },
        callbacks: makeCallbacks()
      });
      expect(task.status).toBe(TaskStatus.WAITING_APPROVAL);
    });

    it('sets currentNode to approval_gate', () => {
      const task = makeTask();
      const pendingExecutions = new Map();
      pauseExecutionForApproval({
        task,
        pendingExecutions,
        researchSummary: '',
        execution: {
          intent: ActionIntent.WRITE_FILE,
          toolName: 'write_file',
          summary: 'writing'
        },
        callbacks: makeCallbacks()
      });
      expect(task.currentNode).toBe('approval_gate');
    });

    it('sets pendingApproval with risk metadata', () => {
      const task = makeTask();
      const pendingExecutions = new Map();
      pauseExecutionForApproval({
        task,
        pendingExecutions,
        researchSummary: '',
        execution: {
          intent: ActionIntent.WRITE_FILE,
          toolName: 'write_file',
          summary: 'writing'
        },
        callbacks: makeCallbacks()
      });
      expect(task.pendingApproval).toBeDefined();
      expect(task.pendingApproval.toolName).toBe('write_file');
    });

    it('sets activeInterrupt', () => {
      const task = makeTask();
      const pendingExecutions = new Map();
      pauseExecutionForApproval({
        task,
        pendingExecutions,
        researchSummary: '',
        execution: {
          intent: ActionIntent.WRITE_FILE,
          toolName: 'write_file',
          summary: 'writing'
        },
        callbacks: makeCallbacks()
      });
      expect(task.activeInterrupt).toBeDefined();
      expect(task.activeInterrupt.status).toBe('pending');
    });

    it('adds approval to approvals array', () => {
      const task = makeTask();
      const pendingExecutions = new Map();
      pauseExecutionForApproval({
        task,
        pendingExecutions,
        researchSummary: '',
        execution: {
          intent: ActionIntent.WRITE_FILE,
          toolName: 'write_file',
          summary: 'writing'
        },
        callbacks: makeCallbacks()
      });
      expect(task.approvals).toHaveLength(1);
      expect(task.approvals[0].decision).toBe('pending');
    });

    it('stores pending execution', () => {
      const task = makeTask();
      const pendingExecutions = new Map();
      pauseExecutionForApproval({
        task,
        pendingExecutions,
        researchSummary: 'research done',
        execution: {
          intent: ActionIntent.WRITE_FILE,
          toolName: 'write_file',
          summary: 'writing',
          toolInput: { path: 'test.ts' }
        },
        callbacks: makeCallbacks()
      });
      expect(pendingExecutions.has('task-1')).toBe(true);
      expect(pendingExecutions.get('task-1').toolName).toBe('write_file');
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
          toolName: 'write_file',
          summary: 'writing',
          approvalReason: 'custom reason'
        },
        callbacks
      });
      expect(task.pendingApproval.reason).toBe('custom reason');
    });

    it('handles watchdog interrupt', () => {
      const task = makeTask();
      const callbacks = makeCallbacks();
      pauseExecutionForApproval({
        task,
        pendingExecutions: new Map(),
        researchSummary: '',
        execution: {
          intent: ActionIntent.EXECUTE,
          toolName: 'terminal',
          summary: 'running',
          approvalReasonCode: 'watchdog_timeout'
        },
        callbacks
      });
      expect(task.currentNode).toBe('runtime_governance_gate');
      expect(task.activeInterrupt.source).toBe('tool');
    });

    it('handles watchdog interaction required', () => {
      const task = makeTask();
      const callbacks = makeCallbacks();
      pauseExecutionForApproval({
        task,
        pendingExecutions: new Map(),
        researchSummary: '',
        execution: {
          intent: ActionIntent.EXECUTE,
          toolName: 'terminal',
          summary: 'running',
          approvalReasonCode: 'watchdog_interaction_required'
        },
        callbacks
      });
      expect(task.currentNode).toBe('runtime_governance_gate');
      expect(task.activeInterrupt.kind).toBe('runtime-governance');
    });

    it('sets result to execution summary', () => {
      const task = makeTask();
      pauseExecutionForApproval({
        task,
        pendingExecutions: new Map(),
        researchSummary: '',
        execution: {
          intent: ActionIntent.WRITE_FILE,
          toolName: 'write_file',
          summary: 'file write summary'
        },
        callbacks: makeCallbacks()
      });
      expect(task.result).toBe('file write summary');
    });

    it('adds interrupt to history', () => {
      const task = makeTask({ interruptHistory: [] });
      pauseExecutionForApproval({
        task,
        pendingExecutions: new Map(),
        researchSummary: '',
        execution: {
          intent: ActionIntent.WRITE_FILE,
          toolName: 'write_file',
          summary: 'writing'
        },
        callbacks: makeCallbacks()
      });
      expect(task.interruptHistory).toHaveLength(1);
    });

    it('uses default toolName for requestedBy', () => {
      const task = makeTask({ currentMinistry: undefined });
      pauseExecutionForApproval({
        task,
        pendingExecutions: new Map(),
        researchSummary: '',
        execution: {
          intent: ActionIntent.WRITE_FILE,
          toolName: 'write_file',
          summary: 'writing'
        },
        callbacks: makeCallbacks()
      });
      expect(task.pendingApproval.requestedBy).toBe('gongbu-code');
    });

    it('includes serverId and capabilityId in pending approval', () => {
      const task = makeTask();
      pauseExecutionForApproval({
        task,
        pendingExecutions: new Map(),
        researchSummary: '',
        execution: {
          intent: ActionIntent.WRITE_FILE,
          toolName: 'write_file',
          summary: 'writing',
          serverId: 'server-1',
          capabilityId: 'cap-1'
        },
        callbacks: makeCallbacks()
      });
      expect(task.pendingApproval.serverId).toBe('server-1');
    });

    it('sets approval preview when provided', () => {
      const task = makeTask();
      pauseExecutionForApproval({
        task,
        pendingExecutions: new Map(),
        researchSummary: '',
        execution: {
          intent: ActionIntent.WRITE_FILE,
          toolName: 'write_file',
          summary: 'writing',
          approvalPreview: [{ label: 'File', value: 'test.ts' }]
        },
        callbacks: makeCallbacks()
      });
      expect(task.pendingApproval.preview).toBeDefined();
    });
  });
});
