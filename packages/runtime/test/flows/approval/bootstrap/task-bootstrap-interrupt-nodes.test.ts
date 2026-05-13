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
  runPreExecutionSkillGateNode,
  runTaskBootstrapFinishNode
} from '../../../../src/flows/approval/bootstrap/task-bootstrap-interrupt-nodes';
import { interrupt } from '@langchain/langgraph';

function makeState(overrides: Record<string, unknown> = {}): any {
  return { taskId: 'task-1', goal: 'test', blocked: false, ...overrides };
}

function makeTask(overrides: Record<string, unknown> = {}): any {
  return {
    id: 'task-1',
    status: TaskStatus.QUEUED,
    goal: 'test goal',
    runId: 'run-1',
    sessionId: 'sess-1',
    currentMinistry: undefined,
    currentNode: 'bootstrap',
    currentStep: 'bootstrap',
    usedInstalledSkills: [],
    approvals: [],
    interruptHistory: [],
    activeInterrupt: undefined,
    pendingApproval: undefined,
    pendingAction: undefined,
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
    attachTool: vi.fn(),
    recordToolUsage: vi.fn(),
    addTrace: vi.fn(),
    addProgressDelta: vi.fn(),
    persistAndEmitTask: vi.fn().mockResolvedValue(undefined),
    transitionQueueState: vi.fn(),
    registerPendingExecution: vi.fn(),
    resolvePreExecutionSkillIntervention: vi.fn().mockResolvedValue(undefined),
    resolveSkillInstallInterruptResume: vi.fn().mockResolvedValue(undefined),
    ...overrides
  };
}

describe('runPreExecutionSkillGateNode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (interrupt as any).mockReturnValue({ action: 'approve', payload: {} });
  });

  it('returns unblocked when task has no skillSearch', async () => {
    const task = makeTask({ skillSearch: undefined });
    const callbacks = makeCallbacks();
    const result = await runPreExecutionSkillGateNode(makeState(), task, callbacks);

    expect(result.blocked).toBe(false);
    expect(callbacks.persistAndEmitTask).toHaveBeenCalled();
  });

  it('returns unblocked when task has no runId', async () => {
    const task = makeTask({ runId: undefined });
    const callbacks = makeCallbacks();
    const result = await runPreExecutionSkillGateNode(makeState(), task, callbacks);

    expect(result.blocked).toBe(false);
  });

  it('returns unblocked when no intervention result', async () => {
    const task = makeTask();
    const callbacks = makeCallbacks({
      resolvePreExecutionSkillIntervention: vi.fn().mockResolvedValue(undefined)
    });
    const result = await runPreExecutionSkillGateNode(makeState(), task, callbacks);

    expect(result.blocked).toBe(false);
  });

  it('returns unblocked when intervention has no pending approval', async () => {
    const task = makeTask();
    const callbacks = makeCallbacks({
      resolvePreExecutionSkillIntervention: vi.fn().mockResolvedValue({
        traceSummary: 'all good',
        progressSummary: 'done'
      })
    });
    const result = await runPreExecutionSkillGateNode(makeState(), task, callbacks);

    expect(result.blocked).toBe(false);
  });

  it('blocks when approval is rejected', async () => {
    const task = makeTask();
    const callbacks = makeCallbacks({
      resolvePreExecutionSkillIntervention: vi.fn().mockResolvedValue({
        pendingApproval: { toolName: 'remote-skill', reason: 'install needed', preview: [] },
        pendingExecution: { receiptId: 'receipt-1', skillDisplayName: 'Remote Skill' }
      })
    });

    (interrupt as any).mockReturnValue({ action: 'reject', feedback: 'denied' });

    const result = await runPreExecutionSkillGateNode(makeState(), task, callbacks);

    expect(result.blocked).toBe(true);
    expect(task.status).toBe(TaskStatus.BLOCKED);
  });

  it('returns unblocked when approval is granted', async () => {
    const task = makeTask();
    const callbacks = makeCallbacks({
      resolvePreExecutionSkillIntervention: vi.fn().mockResolvedValue({
        pendingApproval: { toolName: 'remote-skill', reason: 'install needed' },
        pendingExecution: { receiptId: 'receipt-1', skillDisplayName: 'Remote Skill' }
      }),
      resolveSkillInstallInterruptResume: vi.fn().mockResolvedValue({
        usedInstalledSkills: ['remote-skill']
      })
    });

    (interrupt as any).mockReturnValue({ action: 'approve', payload: {} });

    const result = await runPreExecutionSkillGateNode(makeState(), task, callbacks);

    expect(result.blocked).toBe(false);
    expect(task.status).toBe(TaskStatus.QUEUED);
  });

  it('blocks when interrupt returns undefined', async () => {
    const task = makeTask();
    const callbacks = makeCallbacks({
      resolvePreExecutionSkillIntervention: vi.fn().mockResolvedValue({
        pendingApproval: { toolName: 'remote-skill', reason: 'install needed' },
        pendingExecution: { receiptId: 'receipt-1', skillDisplayName: 'Remote Skill' }
      })
    });

    (interrupt as any).mockReturnValue(undefined);

    const result = await runPreExecutionSkillGateNode(makeState(), task, callbacks);

    expect(result.blocked).toBe(true);
    expect(task.status).toBe(TaskStatus.BLOCKED);
  });

  it('sets task to WAITING_APPROVAL during interrupt flow', async () => {
    const task = makeTask();
    const callbacks = makeCallbacks({
      resolvePreExecutionSkillIntervention: vi.fn().mockResolvedValue({
        pendingApproval: { toolName: 'remote-skill', reason: 'install needed' },
        pendingExecution: { receiptId: 'receipt-1', skillDisplayName: 'Remote Skill' }
      })
    });

    (interrupt as any).mockReturnValue({ action: 'reject' });

    await runPreExecutionSkillGateNode(makeState(), task, callbacks);

    expect(task.currentNode).toBe('approval_gate');
    expect(task.currentStep).toBe('waiting_skill_install_approval');
    expect(callbacks.transitionQueueState).toHaveBeenCalledWith(task, 'waiting_approval');
  });

  it('registers pending execution', async () => {
    const task = makeTask();
    const callbacks = makeCallbacks({
      resolvePreExecutionSkillIntervention: vi.fn().mockResolvedValue({
        pendingApproval: { toolName: 'remote-skill', reason: 'install needed' },
        pendingExecution: { receiptId: 'receipt-1', skillDisplayName: 'Remote Skill' }
      })
    });

    (interrupt as any).mockReturnValue({ action: 'reject' });

    await runPreExecutionSkillGateNode(makeState(), task, callbacks);

    expect(callbacks.registerPendingExecution).toHaveBeenCalledWith(
      'task-1',
      expect.objectContaining({
        receiptId: 'receipt-1',
        skillDisplayName: 'Remote Skill',
        kind: 'skill_install'
      })
    );
  });
});

describe('runTaskBootstrapFinishNode', () => {
  it('returns state unchanged', async () => {
    const state = makeState();
    const result = await runTaskBootstrapFinishNode(state);
    expect(result).toBe(state);
  });
});
