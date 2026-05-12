import { describe, expect, it, vi, beforeEach } from 'vitest';

import { ActionIntent, TaskStatus } from '@agent/core';

vi.mock('@langchain/langgraph', () => ({
  interrupt: vi.fn(() => ({ action: 'approve', payload: {} }))
}));

vi.mock('../../../../src/bridges/supervisor-runtime-bridge', () => ({
  markExecutionStepBlocked: vi.fn(),
  markExecutionStepResumed: vi.fn()
}));

vi.mock('../../../../src/flows/approval/interrupt-idempotency', () => ({
  recordPendingInterruptOnce: vi.fn(() => true),
  recordPendingApprovalOnce: vi.fn(() => true)
}));

vi.mock('../../../../src/flows/approval/risk-interrupts', () => ({
  extendInterruptWithRiskMetadata: vi.fn(record => record),
  extendPendingApprovalWithRiskMetadata: vi.fn(record => record)
}));

import {
  runDirectReplySkillGateNode,
  runDirectReplyNode,
  runDirectReplyInterruptFinishNode
} from '../../../../src/flows/chat/direct-reply/direct-reply-interrupt-nodes';
import { interrupt } from '@langchain/langgraph';

function makeState(overrides: Record<string, unknown> = {}): any {
  return { taskId: 'task-1', goal: 'test', blocked: false, finalAnswer: undefined, ...overrides };
}

function makeTask(overrides: Record<string, unknown> = {}): any {
  return {
    id: 'task-1',
    status: TaskStatus.RUNNING,
    goal: 'test goal',
    currentMinistry: 'libu-governance',
    currentNode: 'direct_reply',
    currentStep: 'direct_reply',
    usedInstalledSkills: [],
    approvals: [],
    interruptHistory: [],
    activeInterrupt: undefined,
    pendingApproval: undefined,
    pendingAction: undefined,
    result: 'test result',
    skillSearch: {
      capabilityGapDetected: true,
      suggestions: [{ id: 's1', displayName: 'Test Skill' }],
      status: 'found'
    },
    ...overrides
  };
}

function makeCallbacks(overrides: Record<string, unknown> = {}): any {
  return {
    ensureTaskNotCancelled: vi.fn(),
    attachTool: vi.fn(),
    recordToolUsage: vi.fn(),
    addTrace: vi.fn(),
    addProgressDelta: vi.fn(),
    setSubTaskStatus: vi.fn(),
    persistAndEmitTask: vi.fn().mockResolvedValue(undefined),
    transitionQueueState: vi.fn(),
    registerPendingExecution: vi.fn(),
    resolveRuntimeSkillIntervention: vi.fn().mockResolvedValue(undefined),
    resolveSkillInstallInterruptResume: vi.fn().mockResolvedValue(undefined),
    runDirectReplyTask: vi.fn().mockResolvedValue(undefined),
    ...overrides
  };
}

describe('runDirectReplySkillGateNode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (interrupt as any).mockReturnValue({ action: 'approve', payload: {} });
  });

  it('returns unblocked when no skillSearch', async () => {
    const task = makeTask({ skillSearch: undefined });
    const callbacks = makeCallbacks();
    const result = await runDirectReplySkillGateNode(makeState(), task, callbacks);

    expect(result.blocked).toBe(false);
    expect(callbacks.ensureTaskNotCancelled).toHaveBeenCalled();
  });

  it('returns unblocked when no capability gap', async () => {
    const task = makeTask({
      skillSearch: { capabilityGapDetected: false, suggestions: [], status: 'none' }
    });
    const callbacks = makeCallbacks();
    const result = await runDirectReplySkillGateNode(makeState(), task, callbacks);

    expect(result.blocked).toBe(false);
  });

  it('returns unblocked when usedInstalledSkills is non-empty', async () => {
    const task = makeTask({ usedInstalledSkills: ['skill-1'] });
    const callbacks = makeCallbacks();
    const result = await runDirectReplySkillGateNode(makeState(), task, callbacks);

    expect(result.blocked).toBe(false);
  });

  it('returns unblocked when resolveRuntimeSkillIntervention returns undefined', async () => {
    const task = makeTask();
    const callbacks = makeCallbacks({
      resolveRuntimeSkillIntervention: vi.fn().mockResolvedValue(undefined)
    });
    const result = await runDirectReplySkillGateNode(makeState(), task, callbacks);

    expect(result.blocked).toBe(false);
  });

  it('returns unblocked when no pending approval', async () => {
    const task = makeTask();
    const callbacks = makeCallbacks({
      resolveRuntimeSkillIntervention: vi.fn().mockResolvedValue({
        traceSummary: 'done',
        progressSummary: 'done'
      })
    });
    const result = await runDirectReplySkillGateNode(makeState(), task, callbacks);

    expect(result.blocked).toBe(false);
  });

  it('blocks when approval is rejected', async () => {
    const task = makeTask();
    const callbacks = makeCallbacks({
      resolveRuntimeSkillIntervention: vi.fn().mockResolvedValue({
        pendingApproval: { toolName: 'remote-skill', reason: 'install needed', preview: [] },
        pendingExecution: { receiptId: 'receipt-1', skillDisplayName: 'Remote Skill' }
      })
    });

    (interrupt as any).mockReturnValue({ action: 'reject', feedback: 'denied' });

    const result = await runDirectReplySkillGateNode(makeState(), task, callbacks);

    expect(result.blocked).toBe(true);
    expect(task.status).toBe(TaskStatus.BLOCKED);
    expect(task.approvalFeedback).toBe('denied');
  });

  it('returns unblocked when approval granted', async () => {
    const task = makeTask();
    const callbacks = makeCallbacks({
      resolveRuntimeSkillIntervention: vi.fn().mockResolvedValue({
        pendingApproval: { toolName: 'remote-skill', reason: 'install needed' },
        pendingExecution: { receiptId: 'receipt-1', skillDisplayName: 'Remote Skill' }
      }),
      resolveSkillInstallInterruptResume: vi.fn().mockResolvedValue({
        usedInstalledSkills: ['remote-skill']
      })
    });

    (interrupt as any).mockReturnValue({ action: 'approve' });

    const result = await runDirectReplySkillGateNode(makeState(), task, callbacks);

    expect(result.blocked).toBe(false);
    expect(task.status).toBe(TaskStatus.RUNNING);
  });

  it('sets task to WAITING_APPROVAL during interrupt', async () => {
    const task = makeTask();
    const callbacks = makeCallbacks({
      resolveRuntimeSkillIntervention: vi.fn().mockResolvedValue({
        pendingApproval: { toolName: 'remote-skill', reason: 'install needed' },
        pendingExecution: { receiptId: 'receipt-1', skillDisplayName: 'Remote Skill' }
      })
    });

    (interrupt as any).mockReturnValue({ action: 'reject' });

    await runDirectReplySkillGateNode(makeState(), task, callbacks);

    expect(task.currentNode).toBe('approval_gate');
    expect(task.currentStep).toBe('waiting_skill_install_approval');
    expect(callbacks.transitionQueueState).toHaveBeenCalledWith(task, 'waiting_approval');
  });

  it('blocks when interrupt returns undefined', async () => {
    const task = makeTask();
    const callbacks = makeCallbacks({
      resolveRuntimeSkillIntervention: vi.fn().mockResolvedValue({
        pendingApproval: { toolName: 'remote-skill', reason: 'install needed' },
        pendingExecution: { receiptId: 'receipt-1', skillDisplayName: 'Remote Skill' }
      })
    });

    (interrupt as any).mockReturnValue(undefined);

    const result = await runDirectReplySkillGateNode(makeState(), task, callbacks);

    expect(result.blocked).toBe(true);
  });

  it('merges usedInstalledSkills from resolved intervention', async () => {
    const task = makeTask();
    const callbacks = makeCallbacks({
      resolveRuntimeSkillIntervention: vi.fn().mockResolvedValue({
        usedInstalledSkills: ['pre-installed'],
        pendingApproval: { toolName: 'remote-skill', reason: 'install needed' },
        pendingExecution: { receiptId: 'receipt-1', skillDisplayName: 'Remote Skill' }
      })
    });

    (interrupt as any).mockReturnValue({ action: 'reject' });

    await runDirectReplySkillGateNode(makeState(), task, callbacks);

    expect(task.usedInstalledSkills).toContain('pre-installed');
  });
});

describe('runDirectReplyNode', () => {
  it('returns state unchanged when blocked', async () => {
    const state = makeState({ blocked: true });
    const task = makeTask();
    const callbacks = makeCallbacks();
    const libu = {} as any;

    const result = await runDirectReplyNode(state, task, libu, callbacks);

    expect(result.blocked).toBe(true);
    expect(callbacks.runDirectReplyTask).not.toHaveBeenCalled();
  });

  it('runs direct reply task and returns result', async () => {
    const state = makeState({ blocked: false });
    const task = makeTask({ result: 'final answer' });
    const callbacks = makeCallbacks();
    const libu = {} as any;

    const result = await runDirectReplyNode(state, task, libu, callbacks);

    expect(callbacks.ensureTaskNotCancelled).toHaveBeenCalled();
    expect(callbacks.runDirectReplyTask).toHaveBeenCalledWith(task, libu);
    expect(result.blocked).toBe(false);
    expect(result.finalAnswer).toBe('final answer');
  });
});

describe('runDirectReplyInterruptFinishNode', () => {
  it('returns state unchanged', async () => {
    const state = makeState();
    const result = await runDirectReplyInterruptFinishNode(state);
    expect(result).toBe(state);
  });
});
