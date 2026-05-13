import { describe, expect, it, vi, beforeEach } from 'vitest';

import { ApprovalDecision } from '@agent/core';

vi.mock('../../../src/runtime/runtime-architecture-helpers', () => ({
  normalizeExecutionMode: vi.fn((mode: string) => mode ?? 'execute')
}));

vi.mock('../../../src/bridges/supervisor-runtime-bridge', () => ({
  markExecutionStepBlocked: vi.fn(),
  markExecutionStepCompleted: vi.fn(),
  markExecutionStepStarted: vi.fn()
}));

vi.mock('../../../src/capabilities/capability-pool', () => ({
  resolveCapabilityRedirect: vi.fn(() => ({
    requestedTarget: undefined,
    redirectedTarget: undefined
  }))
}));

vi.mock('../../../src/flows/runtime-stage/runtime-stage-helpers', () => ({
  announceSkillStep: vi.fn(),
  appendExecutionEvidence: vi.fn(),
  completeSkillStep: vi.fn(),
  resolveExecutionDispatchObjective: vi.fn(() => 'execute objective')
}));

vi.mock('../../../src/flows/runtime-stage/runtime-stage-execute', () => ({
  pauseExecutionForApproval: vi.fn()
}));

vi.mock('../../../src/flows/runtime-stage/runtime-stage-execution-resume', () => ({
  resumeApprovedExecution: vi.fn().mockResolvedValue({
    currentStep: 'execute',
    approvalRequired: false,
    approvalStatus: ApprovalDecision.APPROVED,
    executionSummary: 'resumed execution',
    finalAnswer: 'resumed execution'
  })
}));

import { runExecuteStage } from '../../../src/flows/runtime-stage/runtime-stage-execution';
import { resolveCapabilityRedirect } from '../../../src/capabilities/capability-pool';
import { pauseExecutionForApproval } from '../../../src/flows/runtime-stage/runtime-stage-execute';
import { resumeApprovedExecution } from '../../../src/flows/runtime-stage/runtime-stage-execution-resume';
import { normalizeExecutionMode } from '../../../src/runtime/runtime-architecture-helpers';

function makeTask(overrides: Record<string, unknown> = {}): any {
  return {
    id: 'task-1',
    status: 'running',
    currentMinistry: 'gongbu-code',
    currentWorker: 'worker-1',
    executionMode: undefined,
    executionPlan: { mode: 'execute' },
    sandboxState: undefined,
    microLoopCount: 0,
    maxMicroLoops: 2,
    resolvedWorkflow: {},
    modelRoute: [{ ministry: 'gongbu-code', workerId: 'worker-1' }],
    approvals: [],
    trace: [],
    ...overrides
  };
}

function makeState(overrides: Record<string, unknown> = {}): any {
  return {
    retryCount: 0,
    maxRetries: 2,
    researchSummary: 'research done',
    executionSummary: undefined,
    resumeFromApproval: false,
    dispatches: [],
    ...overrides
  };
}

function makeCallbacks(overrides: Record<string, unknown> = {}): any {
  return {
    ensureTaskNotCancelled: vi.fn(),
    syncTaskRuntime: vi.fn(),
    markSubgraph: vi.fn(),
    markWorkerUsage: vi.fn(),
    attachTool: vi.fn(),
    recordToolUsage: vi.fn(),
    addTrace: vi.fn(),
    addProgressDelta: vi.fn(),
    setSubTaskStatus: vi.fn(),
    addMessage: vi.fn(),
    upsertAgentState: vi.fn(),
    persistAndEmitTask: vi.fn().mockResolvedValue(undefined),
    transitionQueueState: vi.fn(),
    resolveExecutionMinistry: vi.fn(() => 'gongbu-code'),
    getMinistryLabel: vi.fn(() => '工部'),
    describeActionIntent: vi.fn(() => '执行'),
    createAgentContext: vi.fn(() => ({ context: 'test' })),
    updateBudgetState: vi.fn((task, overrides) => ({
      stepBudget: 8,
      stepsConsumed: 0,
      ...(task.budgetState ?? {}),
      ...overrides
    })),
    ...overrides
  };
}

function makeGongbu(overrides: Record<string, unknown> = {}): any {
  return {
    execute: vi.fn().mockResolvedValue({
      summary: 'executed successfully',
      intent: 'write_file',
      toolName: 'filesystem',
      requiresApproval: false,
      executionResult: { outputSummary: 'done' }
    }),
    getState: vi.fn(() => ({ state: 'gongbu' })),
    ...overrides
  };
}

describe('runExecuteStage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (normalizeExecutionMode as any).mockImplementation((mode: string) => mode ?? 'execute');
    (resolveCapabilityRedirect as any).mockReturnValue({
      requestedTarget: undefined,
      redirectedTarget: undefined
    });
  });

  it('blocks execution in plan mode', async () => {
    (normalizeExecutionMode as any).mockReturnValue('plan');
    const task = makeTask();
    const callbacks = makeCallbacks();
    const gongbu = makeGongbu();
    const bingbu = {} as any;
    const libuDocs = {} as any;

    const result = await runExecuteStage(
      task,
      'test goal',
      makeState(),
      gongbu,
      bingbu,
      libuDocs,
      new Map(),
      true,
      callbacks
    );

    expect(result.currentStep).toBe('execute');
    expect(result.approvalRequired).toBe(false);
    expect(result.finalAnswer).toContain('计划模式');
    expect(callbacks.persistAndEmitTask).toHaveBeenCalled();
  });

  it('resumes approved execution when resumeFromApproval is true', async () => {
    const task = makeTask();
    const callbacks = makeCallbacks();
    const gongbu = makeGongbu();
    const state = makeState({ resumeFromApproval: true, toolIntent: 'write_file', toolName: 'filesystem' });

    const result = await runExecuteStage(
      task,
      'test goal',
      state,
      gongbu,
      {} as any,
      {} as any,
      new Map(),
      true,
      callbacks
    );

    expect(resumeApprovedExecution).toHaveBeenCalled();
    expect(result.executionSummary).toBe('resumed execution');
  });

  it('executes gongbu when executionMinistry is gongbu-code', async () => {
    const task = makeTask();
    const callbacks = makeCallbacks();
    const gongbu = makeGongbu();
    const bingbu = {} as any;
    const libuDocs = {} as any;

    const result = await runExecuteStage(
      task,
      'test goal',
      makeState(),
      gongbu,
      bingbu,
      libuDocs,
      new Map(),
      true,
      callbacks
    );

    expect(gongbu.execute).toHaveBeenCalled();
    expect(result.executionSummary).toBe('executed successfully');
    expect(result.approvalRequired).toBe(false);
    expect(result.approvalStatus).toBe(ApprovalDecision.APPROVED);
  });

  it('executes bingbu when executionMinistry is bingbu-ops', async () => {
    const task = makeTask();
    const callbacks = makeCallbacks({ resolveExecutionMinistry: () => 'bingbu-ops' });
    const gongbu = makeGongbu();
    const bingbu = {
      execute: vi.fn().mockResolvedValue({
        summary: 'ops executed',
        intent: 'execute',
        toolName: 'sandbox',
        requiresApproval: false,
        executionResult: {}
      }),
      getState: vi.fn(() => ({ state: 'bingbu' }))
    };
    const libuDocs = {} as any;

    const result = await runExecuteStage(
      task,
      'test goal',
      makeState(),
      gongbu,
      bingbu,
      libuDocs,
      new Map(),
      true,
      callbacks
    );

    expect(bingbu.execute).toHaveBeenCalled();
    expect(result.executionSummary).toBe('ops executed');
  });

  it('executes libuDocs when executionMinistry is libu-delivery', async () => {
    const task = makeTask();
    const callbacks = makeCallbacks({ resolveExecutionMinistry: () => 'libu-delivery' });
    const gongbu = makeGongbu();
    const libuDocs = {
      execute: vi.fn().mockResolvedValue({
        summary: 'docs executed',
        intent: 'review',
        toolName: 'docs',
        requiresApproval: false,
        executionResult: {}
      }),
      getState: vi.fn(() => ({ state: 'docs' }))
    };

    const result = await runExecuteStage(
      task,
      'test goal',
      makeState(),
      gongbu,
      {} as any,
      libuDocs,
      new Map(),
      true,
      callbacks
    );

    expect(libuDocs.execute).toHaveBeenCalled();
    expect(result.executionSummary).toBe('docs executed');
  });

  it('pauses for approval when execution requires it', async () => {
    const task = makeTask();
    const callbacks = makeCallbacks();
    const gongbu = makeGongbu({
      execute: vi.fn().mockResolvedValue({
        summary: 'needs approval',
        intent: 'write_file',
        toolName: 'filesystem',
        requiresApproval: true,
        executionResult: {}
      })
    });

    const result = await runExecuteStage(
      task,
      'test goal',
      makeState(),
      gongbu,
      {} as any,
      {} as any,
      new Map(),
      true,
      callbacks
    );

    expect(pauseExecutionForApproval).toHaveBeenCalled();
    expect(result.approvalRequired).toBe(true);
    expect(result.approvalStatus).toBe('pending');
  });

  it('completes skill step when no approval needed', async () => {
    const task = makeTask();
    const callbacks = makeCallbacks();
    const gongbu = makeGongbu();

    await runExecuteStage(task, 'test goal', makeState(), gongbu, {} as any, {} as any, new Map(), true, callbacks);

    expect(callbacks.setSubTaskStatus).toHaveBeenCalledWith(expect.anything(), expect.anything(), 'completed');
  });

  it('sets sandbox state to passed on success', async () => {
    const task = makeTask();
    const callbacks = makeCallbacks();
    const gongbu = makeGongbu();

    await runExecuteStage(task, 'test goal', makeState(), gongbu, {} as any, {} as any, new Map(), true, callbacks);

    expect(task.sandboxState.status).toBe('passed');
    expect(task.sandboxState.verdict).toBe('safe');
  });

  it('handles readonly fallback when capability redirect needs fallback', async () => {
    (resolveCapabilityRedirect as any).mockReturnValue({
      requestedTarget: 'deprecated-tool',
      redirectedTarget: 'new-tool',
      requiresReadonlyFallback: true,
      redirectAttachment: false
    });

    const task = makeTask();
    const callbacks = makeCallbacks();
    const gongbu = makeGongbu({
      execute: vi.fn().mockResolvedValue({
        summary: 'executed',
        intent: 'write_file',
        toolName: 'deprecated-tool',
        requiresApproval: false,
        executionResult: { capabilityId: 'cap-1' }
      })
    });

    const result = await runExecuteStage(
      task,
      'test goal',
      makeState(),
      gongbu,
      {} as any,
      {} as any,
      new Map(),
      true,
      callbacks
    );

    expect(result.finalAnswer).toContain('弃用');
    expect(result.executionResult).toBeUndefined();
  });

  it('throws when capability redirect replacement is unavailable without fallback', async () => {
    (resolveCapabilityRedirect as any).mockReturnValue({
      requestedTarget: 'deprecated-tool',
      redirectedTarget: 'new-tool',
      requiresReadonlyFallback: false,
      redirectAttachment: false
    });

    const task = makeTask();
    const callbacks = makeCallbacks();
    const gongbu = makeGongbu({
      execute: vi.fn().mockResolvedValue({
        summary: 'executed',
        intent: 'write_file',
        toolName: 'deprecated-tool',
        requiresApproval: false,
        executionResult: { capabilityId: 'cap-1' }
      })
    });

    await expect(
      runExecuteStage(task, 'test goal', makeState(), gongbu, {} as any, {} as any, new Map(), true, callbacks)
    ).rejects.toThrow('deprecated');
  });

  it('sets sandbox to running with retry verdict when approval required', async () => {
    const task = makeTask();
    const callbacks = makeCallbacks();
    const gongbu = makeGongbu({
      execute: vi.fn().mockResolvedValue({
        summary: 'needs approval',
        intent: 'execute',
        toolName: 'sandbox',
        requiresApproval: true,
        executionResult: {}
      })
    });

    await runExecuteStage(task, 'test goal', makeState(), gongbu, {} as any, {} as any, new Map(), true, callbacks);

    expect(task.sandboxState.status).toBe('running');
    expect(task.sandboxState.verdict).toBe('retry');
  });

  it('records watchdog trace when approval reason code is watchdog_timeout', async () => {
    const task = makeTask();
    const callbacks = makeCallbacks();
    const gongbu = makeGongbu({
      execute: vi.fn().mockResolvedValue({
        summary: 'watchdog triggered',
        intent: 'execute',
        toolName: 'sandbox',
        requiresApproval: true,
        executionResult: {},
        approvalReasonCode: 'watchdog_timeout'
      })
    });

    await runExecuteStage(task, 'test goal', makeState(), gongbu, {} as any, {} as any, new Map(), true, callbacks);

    expect(callbacks.addTrace).toHaveBeenCalledWith(
      expect.anything(),
      'node_progress',
      expect.stringContaining('看门狗'),
      expect.anything()
    );
  });
});
