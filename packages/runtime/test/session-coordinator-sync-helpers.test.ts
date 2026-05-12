import { describe, expect, it, vi } from 'vitest';

import { emitExecutionStepEvents, updateCheckpoint } from '../src/session/coordinator/session-coordinator-sync-helpers';

describe('session-coordinator-sync-helpers', () => {
  describe('updateCheckpoint', () => {
    it('copies all task fields to checkpoint', () => {
      const checkpoint: any = {};
      const task = {
        id: 'task-1',
        context: { goal: 'test' },
        runId: 'run-1',
        traceId: 'trace-1',
        skillId: 'skill-1',
        skillStage: 'completed',
        resolvedWorkflow: { id: 'wf-1' },
        currentNode: 'review',
        currentMinistry: 'xingbu-review',
        currentWorker: 'worker-1',
        specialistLead: { id: 'lead-1' },
        supportingSpecialists: [],
        specialistFindings: [],
        routeConfidence: 0.85,
        plannerStrategy: { id: 'strat-1' },
        dispatches: [],
        critiqueResult: { decision: 'pass' },
        chatRoute: { route: 'direct' },
        executionSteps: [{ id: 'step-1', status: 'completed' }],
        currentExecutionStep: { id: 'step-1' },
        queueState: 'completed',
        entryDecision: { decision: 'go' },
        executionPlan: { mode: 'execute' },
        planMode: 'finalized',
        executionMode: 'execute',
        modelRoute: [{ ministry: 'xingbu-review', selectedModel: 'gpt-4' }],
        externalSources: [{ id: 'src-1' }],
        trace: [{ node: 'finish', summary: 'done', at: '2026-04-16T00:00:00.000Z' }],
        messages: [{ id: 'msg-1' }],
        approvals: [{ intent: 'write', decision: 'approved' }],
        learningCandidates: [{ id: 'cand-1' }],
        pendingApproval: undefined,
        activeInterrupt: undefined,
        status: 'completed',
        currentStep: 'finish',
        retryCount: 1,
        maxRetries: 3,
        revisionCount: 0,
        maxRevisions: 2,
        microLoopCount: 0,
        maxMicroLoops: 2
      } as any;
      const thinking = {
        buildThoughtChain: vi.fn().mockReturnValue([]),
        buildThinkState: vi.fn().mockReturnValue(undefined),
        buildThoughtGraph: vi.fn().mockReturnValue({ nodes: [], edges: [] })
      };

      updateCheckpoint(checkpoint, 'chat-1', task, thinking, 'msg-1');

      expect(checkpoint.taskId).toBe('task-1');
      expect(checkpoint.runId).toBe('run-1');
      expect(checkpoint.traceId).toBe('trace-1');
      expect(checkpoint.currentMinistry).toBe('xingbu-review');
      expect(checkpoint.recoverability).toBe('safe');
      expect(checkpoint.traceCursor).toBe(1);
      expect(checkpoint.messageCursor).toBe(1);
      expect(checkpoint.approvalCursor).toBe(1);
      expect(checkpoint.learningCursor).toBe(1);
      expect(checkpoint.graphState.status).toBe('completed');
      expect(checkpoint.thoughtChain).toEqual([]);
      expect(thinking.buildThoughtChain).toHaveBeenCalledWith(task, 'msg-1');
    });

    it('sets recoverability to partial when pending approval exists', () => {
      const checkpoint: any = {};
      const task = {
        trace: [],
        messages: [],
        approvals: [],
        pendingApproval: { intent: 'write' }
      } as any;
      const thinking = {
        buildThoughtChain: vi.fn().mockReturnValue([]),
        buildThinkState: vi.fn(),
        buildThoughtGraph: vi.fn().mockReturnValue({ nodes: [], edges: [] })
      };

      updateCheckpoint(checkpoint, 'chat-1', task, thinking);
      expect(checkpoint.recoverability).toBe('partial');
    });

    it('sets recoverability to partial when active interrupt exists', () => {
      const checkpoint: any = {};
      const task = {
        trace: [],
        messages: [],
        approvals: [],
        activeInterrupt: { id: 'int-1' }
      } as any;
      const thinking = {
        buildThoughtChain: vi.fn().mockReturnValue([]),
        buildThinkState: vi.fn(),
        buildThoughtGraph: vi.fn().mockReturnValue({ nodes: [], edges: [] })
      };

      updateCheckpoint(checkpoint, 'chat-1', task, thinking);
      expect(checkpoint.recoverability).toBe('partial');
    });

    it('filters pending approvals by intent', () => {
      const checkpoint: any = {};
      const task = {
        trace: [],
        messages: [],
        approvals: [
          { intent: 'write', decision: 'pending' },
          { intent: 'execute', decision: 'pending' },
          { intent: 'write', decision: 'approved' }
        ],
        pendingApproval: { intent: 'write' }
      } as any;
      const thinking = {
        buildThoughtChain: vi.fn().mockReturnValue([]),
        buildThinkState: vi.fn(),
        buildThoughtGraph: vi.fn().mockReturnValue({ nodes: [], edges: [] })
      };

      updateCheckpoint(checkpoint, 'chat-1', task, thinking);
      expect(checkpoint.pendingApprovals).toHaveLength(1);
      expect(checkpoint.pendingApprovals[0].intent).toBe('write');
      expect(checkpoint.pendingApprovals[0].decision).toBe('pending');
    });

    it('resolves execution mode from planMode when executionMode is not set', () => {
      const checkpoint: any = {};
      const task = {
        trace: [],
        messages: [],
        approvals: [],
        planMode: 'drafting'
      } as any;
      const thinking = {
        buildThoughtChain: vi.fn().mockReturnValue([]),
        buildThinkState: vi.fn(),
        buildThoughtGraph: vi.fn().mockReturnValue({ nodes: [], edges: [] })
      };

      updateCheckpoint(checkpoint, 'chat-1', task, thinking);
      expect(checkpoint.executionMode).toBe('plan');
    });

    it('resolves execution mode to execute for finalized planMode', () => {
      const checkpoint: any = {};
      const task = {
        trace: [],
        messages: [],
        approvals: [],
        planMode: 'finalized'
      } as any;
      const thinking = {
        buildThoughtChain: vi.fn().mockReturnValue([]),
        buildThinkState: vi.fn(),
        buildThoughtGraph: vi.fn().mockReturnValue({ nodes: [], edges: [] })
      };

      updateCheckpoint(checkpoint, 'chat-1', task, thinking);
      expect(checkpoint.executionMode).toBe('execute');
    });
  });

  describe('emitExecutionStepEvents', () => {
    it('emits event for new execution steps', () => {
      const store = { addEvent: vi.fn() };
      const task = {
        id: 'task-1',
        executionSteps: [{ id: 'step-1', stage: 'research', status: 'running', label: 'Research', owner: 'hubu' }]
      } as any;

      emitExecutionStepEvents(store as any, 'session-1', task, []);

      expect(store.addEvent).toHaveBeenCalledTimes(1);
      expect(store.addEvent).toHaveBeenCalledWith(
        'session-1',
        'execution_step_started',
        expect.objectContaining({
          taskId: 'task-1',
          stage: 'research',
          status: 'running'
        })
      );
    });

    it('emits completed event when step status changes to completed', () => {
      const store = { addEvent: vi.fn() };
      const task = {
        id: 'task-1',
        executionSteps: [
          {
            id: 'step-1',
            stage: 'execution',
            status: 'completed',
            label: 'Exec',
            owner: 'gongbu',
            detail: 'done',
            completedAt: '2026-04-16T01:00:00.000Z'
          }
        ]
      } as any;
      const previous = [{ id: 'step-1', stage: 'execution', status: 'running', label: 'Exec', owner: 'gongbu' }];

      emitExecutionStepEvents(store as any, 'session-1', task, previous as any);

      expect(store.addEvent).toHaveBeenCalledWith('session-1', 'execution_step_completed', expect.anything());
    });

    it('emits blocked event when step status changes to blocked', () => {
      const store = { addEvent: vi.fn() };
      const task = {
        id: 'task-1',
        executionSteps: [
          {
            id: 'step-1',
            stage: 'execution',
            status: 'blocked',
            label: 'Exec',
            owner: 'gongbu',
            reason: 'needs approval'
          }
        ]
      } as any;
      const previous = [{ id: 'step-1', stage: 'execution', status: 'running', label: 'Exec', owner: 'gongbu' }];

      emitExecutionStepEvents(store as any, 'session-1', task, previous as any);

      expect(store.addEvent).toHaveBeenCalledWith('session-1', 'execution_step_blocked', expect.anything());
    });

    it('emits resumed event when step goes from blocked to running', () => {
      const store = { addEvent: vi.fn() };
      const task = {
        id: 'task-1',
        executionSteps: [{ id: 'step-1', stage: 'execution', status: 'running', label: 'Exec', owner: 'gongbu' }]
      } as any;
      const previous = [{ id: 'step-1', stage: 'execution', status: 'blocked', label: 'Exec', owner: 'gongbu' }];

      emitExecutionStepEvents(store as any, 'session-1', task, previous as any);

      expect(store.addEvent).toHaveBeenCalledWith('session-1', 'execution_step_resumed', expect.anything());
    });

    it('does not emit event when step unchanged', () => {
      const store = { addEvent: vi.fn() };
      const step = { id: 'step-1', stage: 'execution', status: 'running', label: 'Exec', owner: 'gongbu' };
      const task = { id: 'task-1', executionSteps: [step] } as any;

      emitExecutionStepEvents(store as any, 'session-1', task, [step] as any);

      expect(store.addEvent).not.toHaveBeenCalled();
    });

    it('emits event when step detail changes', () => {
      const store = { addEvent: vi.fn() };
      const task = {
        id: 'task-1',
        executionSteps: [
          { id: 'step-1', stage: 'execution', status: 'running', label: 'Exec', owner: 'gongbu', detail: 'updated' }
        ]
      } as any;
      const previous = [
        { id: 'step-1', stage: 'execution', status: 'running', label: 'Exec', owner: 'gongbu', detail: 'original' }
      ];

      emitExecutionStepEvents(store as any, 'session-1', task, previous as any);

      expect(store.addEvent).toHaveBeenCalledTimes(1);
    });

    it('handles undefined executionSteps', () => {
      const store = { addEvent: vi.fn() };
      const task = { id: 'task-1' } as any;

      emitExecutionStepEvents(store as any, 'session-1', task, []);

      expect(store.addEvent).not.toHaveBeenCalled();
    });
  });
});
