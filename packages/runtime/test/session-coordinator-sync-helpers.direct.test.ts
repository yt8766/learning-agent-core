import { describe, expect, it, vi } from 'vitest';

import { updateCheckpoint, emitExecutionStepEvents } from '../src/session/coordinator/session-coordinator-sync-helpers';

function makeCheckpoint(overrides: Record<string, unknown> = {}) {
  return {
    taskId: '',
    traceCursor: 0,
    messageCursor: 0,
    approvalCursor: 0,
    learningCursor: 0,
    executionSteps: [],
    ...overrides
  } as any;
}

function makeTask(overrides: Record<string, unknown> = {}) {
  return {
    id: 'task-1',
    runId: 'run-1',
    traceId: 'trace-1',
    context: 'test context',
    status: 'running',
    currentStep: 'execute',
    trace: [],
    messages: [],
    approvals: [],
    executionSteps: [],
    agentStates: [],
    ...overrides
  } as any;
}

function makeThinking() {
  return {
    buildThoughtChain: vi.fn().mockReturnValue([]),
    buildThinkState: vi.fn().mockReturnValue({ title: 'test', content: 'thinking' }),
    buildThoughtGraph: vi.fn().mockReturnValue({ nodes: [], edges: [] })
  } as any;
}

describe('session-coordinator-sync-helpers (direct)', () => {
  describe('updateCheckpoint', () => {
    it('copies task fields to checkpoint', () => {
      const checkpoint = makeCheckpoint();
      const task = makeTask({ context: 'ctx', runId: 'r1', traceId: 't1' });
      const thinking = makeThinking();
      updateCheckpoint(checkpoint, undefined, task, thinking);
      expect(checkpoint.taskId).toBe('task-1');
      expect(checkpoint.context).toBe('ctx');
      expect(checkpoint.runId).toBe('r1');
      expect(checkpoint.traceId).toBe('t1');
    });

    it('sets executionMode from task.executionMode', () => {
      const checkpoint = makeCheckpoint();
      const task = makeTask({ executionMode: 'plan' });
      updateCheckpoint(checkpoint, undefined, task, makeThinking());
      expect(checkpoint.executionMode).toBe('plan');
    });

    it('falls back to executionPlan.mode for executionMode', () => {
      const checkpoint = makeCheckpoint();
      const task = makeTask({ executionPlan: { mode: 'execute' } });
      updateCheckpoint(checkpoint, undefined, task, makeThinking());
      expect(checkpoint.executionMode).toBe('execute');
    });

    it('defaults executionMode to plan when planMode is active', () => {
      const checkpoint = makeCheckpoint();
      const task = makeTask({ planMode: 'drafting' });
      updateCheckpoint(checkpoint, undefined, task, makeThinking());
      expect(checkpoint.executionMode).toBe('plan');
    });

    it('sets recoverability to partial when has pendingApproval', () => {
      const checkpoint = makeCheckpoint();
      const task = makeTask({ pendingApproval: { intent: 'tool_approval' } });
      updateCheckpoint(checkpoint, undefined, task, makeThinking());
      expect(checkpoint.recoverability).toBe('partial');
    });

    it('sets recoverability to safe when no pending approval or interrupt', () => {
      const checkpoint = makeCheckpoint();
      const task = makeTask();
      updateCheckpoint(checkpoint, undefined, task, makeThinking());
      expect(checkpoint.recoverability).toBe('safe');
    });

    it('calls thinking.buildThoughtChain', () => {
      const checkpoint = makeCheckpoint();
      const task = makeTask();
      const thinking = makeThinking();
      updateCheckpoint(checkpoint, undefined, task, thinking, 'msg-1');
      expect(thinking.buildThoughtChain).toHaveBeenCalledWith(task, 'msg-1');
    });

    it('calls thinking.buildThinkState', () => {
      const checkpoint = makeCheckpoint();
      const task = makeTask();
      const thinking = makeThinking();
      updateCheckpoint(checkpoint, undefined, task, thinking, 'msg-1');
      expect(thinking.buildThinkState).toHaveBeenCalledWith(task, 'msg-1');
    });

    it('sets updatedAt', () => {
      const checkpoint = makeCheckpoint();
      const task = makeTask();
      updateCheckpoint(checkpoint, undefined, task, makeThinking());
      expect(checkpoint.updatedAt).toBeDefined();
    });

    it('sets graphState with task status fields', () => {
      const checkpoint = makeCheckpoint();
      const task = makeTask({
        status: 'running',
        currentStep: 'execute',
        retryCount: 1,
        maxRetries: 3,
        revisionCount: 0,
        maxRevisions: 2,
        microLoopCount: 0,
        maxMicroLoops: 2
      });
      updateCheckpoint(checkpoint, undefined, task, makeThinking());
      expect(checkpoint.graphState.status).toBe('running');
      expect(checkpoint.graphState.currentStep).toBe('execute');
      expect(checkpoint.graphState.retryCount).toBe(1);
      expect(checkpoint.graphState.maxRetries).toBe(3);
    });

    it('sets pendingApprovals from task approvals', () => {
      const checkpoint = makeCheckpoint();
      const task = makeTask({
        pendingApproval: { intent: 'tool_approval' },
        approvals: [
          { intent: 'tool_approval', decision: 'pending' },
          { intent: 'tool_approval', decision: 'approved' },
          { intent: 'other', decision: 'pending' }
        ]
      });
      updateCheckpoint(checkpoint, undefined, task, makeThinking());
      expect(checkpoint.pendingApprovals).toHaveLength(1);
      expect(checkpoint.pendingApprovals[0].decision).toBe('pending');
    });

    it('sets empty pendingApprovals when no pendingApproval', () => {
      const checkpoint = makeCheckpoint();
      const task = makeTask({ approvals: [{ intent: 'x', decision: 'pending' }] });
      updateCheckpoint(checkpoint, undefined, task, makeThinking());
      expect(checkpoint.pendingApprovals).toEqual([]);
    });

    it('copies channelIdentity to checkpoint', () => {
      const checkpoint = makeCheckpoint();
      const task = makeTask();
      const channelIdentity = { platform: 'web', userId: 'u1' };
      updateCheckpoint(checkpoint, channelIdentity as any, task, makeThinking());
      expect(checkpoint.channelIdentity).toBe(channelIdentity);
    });
  });

  describe('emitExecutionStepEvents', () => {
    it('emits event for new execution step', () => {
      const events: any[] = [];
      const store = {
        addEvent: vi.fn((sessionId: string, type: string, payload: any) => {
          events.push({ sessionId, type, payload });
        })
      } as any;
      const task = makeTask({
        executionSteps: [
          { id: 'step-1', stage: 'research', status: 'running', label: 'test', owner: 'hubu', detail: 'detail' }
        ]
      });

      emitExecutionStepEvents(store, 's1', task, []);
      expect(store.addEvent).toHaveBeenCalled();
      expect(events[0].type).toBe('execution_step_started');
    });

    it('emits completed event for status change', () => {
      const events: any[] = [];
      const store = {
        addEvent: vi.fn((_: string, type: string, payload: any) => events.push({ type, payload }))
      } as any;
      const task = makeTask({
        executionSteps: [{ id: 'step-1', stage: 'research', status: 'completed', label: 'test', owner: 'hubu' }]
      });
      const previous = [{ id: 'step-1', stage: 'research', status: 'running', label: 'test', owner: 'hubu' }];

      emitExecutionStepEvents(store, 's1', task, previous as any);
      expect(events[0].type).toBe('execution_step_completed');
    });

    it('emits blocked event for blocked status', () => {
      const events: any[] = [];
      const store = {
        addEvent: vi.fn((_: string, type: string, payload: any) => events.push({ type, payload }))
      } as any;
      const task = makeTask({
        executionSteps: [{ id: 'step-1', stage: 'execution', status: 'blocked', label: 'test', owner: 'system' }]
      });
      const previous = [{ id: 'step-1', stage: 'execution', status: 'running', label: 'test', owner: 'system' }];

      emitExecutionStepEvents(store, 's1', task, previous as any);
      expect(events[0].type).toBe('execution_step_blocked');
    });

    it('emits resumed event when blocked then running', () => {
      const events: any[] = [];
      const store = {
        addEvent: vi.fn((_: string, type: string, payload: any) => events.push({ type, payload }))
      } as any;
      const task = makeTask({
        executionSteps: [{ id: 'step-1', stage: 'execution', status: 'running', label: 'test', owner: 'system' }]
      });
      const previous = [{ id: 'step-1', stage: 'execution', status: 'blocked', label: 'test', owner: 'system' }];

      emitExecutionStepEvents(store, 's1', task, previous as any);
      expect(events[0].type).toBe('execution_step_resumed');
    });

    it('does not emit when nothing changed', () => {
      const store = {
        addEvent: vi.fn()
      } as any;
      const step = {
        id: 'step-1',
        stage: 'research',
        status: 'running',
        label: 'test',
        owner: 'hubu',
        detail: 'same',
        reason: undefined,
        startedAt: undefined,
        completedAt: undefined
      };
      const task = makeTask({ executionSteps: [step] });

      emitExecutionStepEvents(store, 's1', task, [step] as any);
      expect(store.addEvent).not.toHaveBeenCalled();
    });

    it('emits event when detail changes', () => {
      const events: any[] = [];
      const store = {
        addEvent: vi.fn((_: string, type: string, payload: any) => events.push({ type, payload }))
      } as any;
      const task = makeTask({
        executionSteps: [
          { id: 'step-1', stage: 'research', status: 'running', label: 'test', owner: 'hubu', detail: 'new detail' }
        ]
      });
      const previous = [
        { id: 'step-1', stage: 'research', status: 'running', label: 'test', owner: 'hubu', detail: 'old detail' }
      ];

      emitExecutionStepEvents(store, 's1', task, previous as any);
      expect(store.addEvent).toHaveBeenCalled();
    });

    it('handles empty executionSteps', () => {
      const store = { addEvent: vi.fn() } as any;
      const task = makeTask({ executionSteps: undefined });
      emitExecutionStepEvents(store, 's1', task, []);
      expect(store.addEvent).not.toHaveBeenCalled();
    });
  });
});
