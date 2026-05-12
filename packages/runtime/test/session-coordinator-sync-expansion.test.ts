import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/utils/event-maps', () => ({
  TASK_MESSAGE_EVENT_MAP: {
    summary: 'assistant_message',
    research_result: 'research_result',
    execution_result: 'execution_result',
    review_result: 'review_result'
  },
  TRACE_EVENT_MAP: {
    decree_received: 'decree_received',
    execute: 'tool_called',
    review: 'review_completed',
    approval_gate: 'interrupt_pending',
    approval_rejected_with_feedback: 'interrupt_rejected_with_feedback'
  }
}));

vi.mock('../src/session/session-node-events', () => ({
  emitNodeStatusEvent: vi.fn()
}));

vi.mock('../src/session/coordinator/session-coordinator-sync-helpers', () => ({
  updateCheckpoint: vi.fn(),
  emitExecutionStepEvents: vi.fn()
}));

import { syncCoordinatorTask } from '../src/session/coordinator/session-coordinator-sync';

function makeStore(overrides: Record<string, any> = {}) {
  const messages = new Map<string, any[]>();
  const checkpoints = new Map<string, any>();
  const events: any[] = [];

  return {
    store: {
      requireSession: vi.fn().mockReturnValue({
        currentTaskId: undefined,
        updatedAt: '',
        status: 'running',
        channelIdentity: 'web'
      }),
      getCheckpoint: vi.fn().mockReturnValue(null),
      createCheckpoint: vi.fn().mockReturnValue({
        taskId: null,
        traceCursor: 0,
        messageCursor: 0,
        approvalCursor: 0,
        learningCursor: 0,
        currentNode: null,
        executionSteps: []
      }),
      getMessages: vi.fn().mockReturnValue([]),
      addEvent: vi.fn().mockImplementation((_sid, type, data) => events.push({ type, data })),
      addMessage: vi.fn().mockImplementation((sid, role, content, linkedAgent, _extra, taskId) => ({
        id: `msg_${events.length}`,
        role,
        content,
        taskId,
        linkedAgent
      })),
      appendStreamingMessage: vi.fn(),
      mergeAssistantCognitionSnapshot: vi.fn(),
      checkpoints,
      ...overrides
    },
    events
  } as any;
}

function makeThinking() {
  return {
    clearThinking: vi.fn(),
    getThinkingState: vi.fn().mockReturnValue(undefined)
  } as any;
}

function makeTask(overrides: Record<string, any> = {}) {
  return {
    id: 'task-1',
    goal: 'test goal',
    status: 'running',
    currentNode: 'route',
    currentStep: 'route',
    result: undefined,
    trace: [],
    messages: [],
    approvals: [],
    learningCandidates: [],
    review: undefined,
    ...overrides
  } as any;
}

describe('syncCoordinatorTask', () => {
  it('sets session currentTaskId and updatedAt', () => {
    const { store } = makeStore();
    const task = makeTask();
    const ensureLearningCandidates = vi.fn();
    const onAutoConfirmLearning = vi.fn();

    syncCoordinatorTask(store, makeThinking(), 'session-1', task, ensureLearningCandidates, onAutoConfirmLearning);

    const session = store.requireSession('session-1');
    expect(session.currentTaskId).toBe('task-1');
    expect(session.updatedAt).toBeTruthy();
  });

  it('creates checkpoint when none exists', () => {
    const { store } = makeStore();
    const task = makeTask();

    syncCoordinatorTask(store, makeThinking(), 'session-1', task, vi.fn(), vi.fn());
    expect(store.createCheckpoint).toHaveBeenCalledWith('session-1', 'task-1');
  });

  it('uses existing checkpoint', () => {
    const existingCheckpoint = {
      taskId: 'task-1',
      traceCursor: 0,
      messageCursor: 0,
      approvalCursor: 0,
      learningCursor: 0,
      currentNode: 'route',
      executionSteps: []
    };
    const { store } = makeStore({ getCheckpoint: vi.fn().mockReturnValue(existingCheckpoint) });
    const task = makeTask();

    syncCoordinatorTask(store, makeThinking(), 'session-1', task, vi.fn(), vi.fn());
    expect(store.createCheckpoint).not.toHaveBeenCalled();
  });

  it('resets cursors when task changes', () => {
    const existingCheckpoint = {
      taskId: 'old-task',
      traceCursor: 5,
      messageCursor: 3,
      approvalCursor: 2,
      learningCursor: 1,
      currentNode: 'route',
      executionSteps: []
    };
    const { store } = makeStore({ getCheckpoint: vi.fn().mockReturnValue(existingCheckpoint) });
    const task = makeTask();

    syncCoordinatorTask(store, makeThinking(), 'session-1', task, vi.fn(), vi.fn());
    expect(existingCheckpoint.traceCursor).toBe(0);
    expect(existingCheckpoint.messageCursor).toBe(0);
    expect(existingCheckpoint.approvalCursor).toBe(0);
    expect(existingCheckpoint.learningCursor).toBe(0);
  });

  it('emits trace events for new traces', () => {
    const { store } = makeStore();
    const task = makeTask({
      trace: [
        { node: 'decree_received', summary: 'Decree received', data: {} },
        { node: 'execute', summary: 'Execution complete', data: {} }
      ]
    });

    syncCoordinatorTask(store, makeThinking(), 'session-1', task, vi.fn(), vi.fn());
    expect(store.addEvent).toHaveBeenCalled();
  });

  it('skips approval_gate and approval_rejected_with_feedback traces', () => {
    const { store } = makeStore();
    const task = makeTask({
      trace: [
        { node: 'approval_gate', summary: 'Approval gate', data: {} },
        { node: 'approval_rejected_with_feedback', summary: 'Rejected', data: {} },
        { node: 'decree_received', summary: 'Decree received', data: {} }
      ]
    });

    syncCoordinatorTask(store, makeThinking(), 'session-1', task, vi.fn(), vi.fn());
    // Only decree_received should produce an event (the others are skipped)
    const traceEvents = (store.addEvent as any).mock.calls.filter((call: any) => call[1] === 'decree_received');
    expect(traceEvents).toHaveLength(1);
  });

  it('handles summary_delta messages as streaming', () => {
    const { store } = makeStore();
    const task = makeTask({
      messages: [{ type: 'summary_delta', content: 'partial', from: 'manager', createdAt: '2026-04-16T00:00:00.000Z' }]
    });

    syncCoordinatorTask(store, makeThinking(), 'session-1', task, vi.fn(), vi.fn());
    expect(store.appendStreamingMessage).toHaveBeenCalled();
  });

  it('handles summary messages by binding assistant result', () => {
    const { store } = makeStore();
    const task = makeTask({
      messages: [{ type: 'summary', content: 'Final answer', from: 'manager', createdAt: '2026-04-16T00:00:00.000Z' }]
    });

    syncCoordinatorTask(store, makeThinking(), 'session-1', task, vi.fn(), vi.fn());
    expect(store.addMessage).toHaveBeenCalledWith(
      'session-1',
      'assistant',
      'Final answer',
      'manager',
      undefined,
      'task-1'
    );
  });

  it('sets session status to waiting_approval when task is waiting', () => {
    const { store } = makeStore();
    const task = makeTask({ status: 'waiting_approval' });

    syncCoordinatorTask(store, makeThinking(), 'session-1', task, vi.fn(), vi.fn());
    const session = store.requireSession('session-1');
    expect(session.status).toBe('waiting_approval');
  });

  it('sets session status to waiting_interrupt when task has activeInterrupt', () => {
    const { store } = makeStore();
    const task = makeTask({
      status: 'waiting_approval',
      activeInterrupt: { kind: 'user-input' }
    });

    syncCoordinatorTask(store, makeThinking(), 'session-1', task, vi.fn(), vi.fn());
    const session = store.requireSession('session-1');
    expect(session.status).toBe('waiting_interrupt');
  });

  it('sets session status to cancelled when task is cancelled', () => {
    const { store } = makeStore();
    const task = makeTask({ status: 'cancelled' });

    syncCoordinatorTask(store, makeThinking(), 'session-1', task, vi.fn(), vi.fn());
    const session = store.requireSession('session-1');
    expect(session.status).toBe('cancelled');
  });

  it('sets session status to failed when task is failed', () => {
    const { store } = makeStore();
    const task = makeTask({ status: 'failed' });

    syncCoordinatorTask(store, makeThinking(), 'session-1', task, vi.fn(), vi.fn());
    const session = store.requireSession('session-1');
    expect(session.status).toBe('failed');
  });

  it('sets session status to failed when task is blocked', () => {
    const { store } = makeStore();
    const task = makeTask({ status: 'blocked' });

    syncCoordinatorTask(store, makeThinking(), 'session-1', task, vi.fn(), vi.fn());
    const session = store.requireSession('session-1');
    expect(session.status).toBe('failed');
  });

  it('sets session status to completed and calls onAutoConfirmLearning', () => {
    const { store } = makeStore();
    const task = makeTask({ status: 'completed', result: 'Done' });
    const onAutoConfirmLearning = vi.fn();

    syncCoordinatorTask(store, makeThinking(), 'session-1', task, vi.fn(), onAutoConfirmLearning);
    const session = store.requireSession('session-1');
    expect(session.status).toBe('completed');
    expect(onAutoConfirmLearning).toHaveBeenCalledWith('session-1', task);
  });

  it('sets session status to running for non-terminal status', () => {
    const { store } = makeStore();
    const task = makeTask({ status: 'running' });

    syncCoordinatorTask(store, makeThinking(), 'session-1', task, vi.fn(), vi.fn());
    const session = store.requireSession('session-1');
    expect(session.status).toBe('running');
  });

  it('binds result message when task has result', () => {
    const { store } = makeStore();
    const task = makeTask({
      status: 'completed',
      result: 'Final result'
    });

    syncCoordinatorTask(store, makeThinking(), 'session-1', task, vi.fn(), vi.fn());
    expect(store.addMessage).toHaveBeenCalledWith(
      'session-1',
      'assistant',
      'Final result',
      undefined,
      undefined,
      'task-1'
    );
  });

  it('handles cancelled task with progress stream message', () => {
    const progressMsg = {
      id: 'progress_stream_task-1',
      role: 'assistant',
      content: 'partial content',
      taskId: undefined
    };
    const { store } = makeStore({
      getMessages: vi.fn().mockReturnValue([progressMsg])
    });
    const task = makeTask({ status: 'cancelled' });

    syncCoordinatorTask(store, makeThinking(), 'session-1', task, vi.fn(), vi.fn());
    expect(progressMsg.taskId).toBe('task-1');
  });

  it('skips approval events for non-current pending approvals', () => {
    const { store } = makeStore();
    const task = makeTask({
      approvals: [{ intent: 'write_file', decision: 'pending', reason: 'old approval' }],
      pendingApproval: { intent: 'delete_file', toolName: 'rm' }
    });

    syncCoordinatorTask(store, makeThinking(), 'session-1', task, vi.fn(), vi.fn());
    // The old pending approval should be skipped
    const approvalEvents = (store.addEvent as any).mock.calls.filter(
      (call: any) => call[1] === 'approval_required' || call[1] === 'approval_resolved'
    );
    expect(approvalEvents).toHaveLength(0);
  });

  it('emits approval_required for current pending approval', () => {
    const { store } = makeStore();
    const task = makeTask({
      approvals: [{ intent: 'write_file', decision: 'pending', reason: 'needs review' }],
      pendingApproval: {
        intent: 'write_file',
        toolName: 'write_scaffold',
        riskLevel: 'high'
      }
    });

    syncCoordinatorTask(store, makeThinking(), 'session-1', task, vi.fn(), vi.fn());
    const approvalEvents = (store.addEvent as any).mock.calls.filter((call: any) => call[1] === 'approval_required');
    expect(approvalEvents).toHaveLength(1);
  });

  it('emits approval_resolved for resolved approvals', () => {
    const { store } = makeStore();
    const task = makeTask({
      approvals: [{ intent: 'write_file', decision: 'approved', actor: 'user' }]
    });

    syncCoordinatorTask(store, makeThinking(), 'session-1', task, vi.fn(), vi.fn());
    const resolvedEvents = (store.addEvent as any).mock.calls.filter((call: any) => call[1] === 'approval_resolved');
    expect(resolvedEvents).toHaveLength(1);
  });

  it('calls ensureLearningCandidates when task has review but no learning candidates', () => {
    const { store } = makeStore();
    const task = makeTask({ review: { decision: 'approved' } });
    const ensureLearningCandidates = vi.fn();

    syncCoordinatorTask(store, makeThinking(), 'session-1', task, ensureLearningCandidates, vi.fn());
    expect(ensureLearningCandidates).toHaveBeenCalledWith(task);
  });

  it('does not call ensureLearningCandidates when learning candidates already exist', () => {
    const { store } = makeStore();
    const task = makeTask({
      review: { decision: 'approved' },
      learningCandidates: [{ id: 'c1' }]
    });
    const ensureLearningCandidates = vi.fn();

    syncCoordinatorTask(store, makeThinking(), 'session-1', task, ensureLearningCandidates, vi.fn());
    expect(ensureLearningCandidates).not.toHaveBeenCalled();
  });
});
