import { describe, expect, it, vi, beforeEach } from 'vitest';

import { ApprovalDecision } from '@agent/core';

vi.mock('../../../src/flows/approval', () => ({
  executeApprovedAction: vi.fn().mockResolvedValue({
    outputSummary: 'execution completed',
    serverId: 'server-1',
    capabilityId: 'cap-1',
    transportUsed: 'stdio',
    fallbackUsed: false,
    exitCode: 0
  })
}));

vi.mock('../../../src/bridges/supervisor-runtime-bridge', () => ({
  markExecutionStepCompleted: vi.fn()
}));

vi.mock('../../../src/flows/runtime-stage/runtime-stage-helpers', () => ({
  appendExecutionEvidence: vi.fn(),
  completeSkillStep: vi.fn()
}));

import { resumeApprovedExecution } from '../../../src/flows/runtime-stage/runtime-stage-execution-resume';

function makeTask(overrides: Record<string, unknown> = {}): any {
  return {
    id: 'task-1',
    status: 'running',
    currentMinistry: 'gongbu-code',
    currentWorker: 'worker-1',
    approvals: [],
    trace: [],
    sandboxState: undefined,
    ...overrides
  };
}

function makeState(overrides: Record<string, unknown> = {}): any {
  return {
    toolIntent: 'write_file',
    toolName: 'filesystem',
    researchSummary: 'research summary',
    pendingToolInput: { path: '/tmp/test' },
    ...overrides
  };
}

function makeCallbacks(overrides: Record<string, unknown> = {}): any {
  return {
    ensureTaskNotCancelled: vi.fn(),
    upsertAgentState: vi.fn(),
    addMessage: vi.fn(),
    attachTool: vi.fn(),
    recordToolUsage: vi.fn(),
    addTrace: vi.fn(),
    addProgressDelta: vi.fn(),
    setSubTaskStatus: vi.fn(),
    persistAndEmitTask: vi.fn().mockResolvedValue(undefined),
    createAgentContext: vi.fn(() => ({ context: 'test' })),
    ...overrides
  };
}

describe('resumeApprovedExecution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('executes approved action and returns result', async () => {
    const task = makeTask();
    const result = await resumeApprovedExecution({
      task,
      dtoGoal: 'test goal',
      state: makeState(),
      executionMinistry: 'gongbu-code',
      gongbu: {
        buildApprovedState: vi.fn(() => ({ state: 'approved' }))
      } as any,
      callbacks: makeCallbacks()
    });

    expect(result.currentStep).toBe('execute');
    expect(result.approvalRequired).toBe(false);
    expect(result.approvalStatus).toBe(ApprovalDecision.APPROVED);
    expect(result.executionSummary).toBe('execution completed');
    expect(result.resumeFromApproval).toBe(false);
    expect(result.shouldRetry).toBe(false);
  });

  it('persists task after execution', async () => {
    const callbacks = makeCallbacks();
    await resumeApprovedExecution({
      task: makeTask(),
      dtoGoal: 'test goal',
      state: makeState(),
      executionMinistry: 'gongbu-code',
      gongbu: { buildApprovedState: vi.fn(() => ({})) } as any,
      callbacks
    });

    expect(callbacks.persistAndEmitTask).toHaveBeenCalled();
  });

  it('records tool usage as approved then completed', async () => {
    const callbacks = makeCallbacks();
    await resumeApprovedExecution({
      task: makeTask(),
      dtoGoal: 'test goal',
      state: makeState(),
      executionMinistry: 'gongbu-code',
      gongbu: { buildApprovedState: vi.fn(() => ({})) } as any,
      callbacks
    });

    expect(callbacks.recordToolUsage).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ status: 'approved' })
    );
    expect(callbacks.recordToolUsage).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ status: 'completed' })
    );
  });

  it('sets sandbox state to passed', async () => {
    const task = makeTask();
    await resumeApprovedExecution({
      task,
      dtoGoal: 'test goal',
      state: makeState(),
      executionMinistry: 'gongbu-code',
      gongbu: { buildApprovedState: vi.fn(() => ({})) } as any,
      callbacks: makeCallbacks()
    });

    expect(task.sandboxState.status).toBe('passed');
    expect(task.sandboxState.verdict).toBe('safe');
  });

  it('sets sandbox stage based on executionMinistry', async () => {
    const task = makeTask();
    await resumeApprovedExecution({
      task,
      dtoGoal: 'test goal',
      state: makeState(),
      executionMinistry: 'bingbu-ops',
      gongbu: { buildApprovedState: vi.fn(() => ({})) } as any,
      callbacks: makeCallbacks()
    });

    expect(task.sandboxState.stage).toBe('bingbu');
  });

  it('uses task.currentMinistry as ownerId for tool attachment', async () => {
    const callbacks = makeCallbacks();
    await resumeApprovedExecution({
      task: makeTask({ currentMinistry: 'gongbu-code' }),
      dtoGoal: 'test goal',
      state: makeState(),
      executionMinistry: 'gongbu-code',
      gongbu: { buildApprovedState: vi.fn(() => ({})) } as any,
      callbacks
    });

    expect(callbacks.attachTool).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ ownerId: 'gongbu-code' })
    );
  });
});
