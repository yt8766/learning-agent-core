import { describe, expect, it, vi, beforeEach } from 'vitest';

import { TaskStatus } from '@agent/core';

vi.mock('../../../../../../src/graphs/main/tasking/runtime/main-graph-task-runtime-errors', () => ({
  TaskBudgetExceededError: class TaskBudgetExceededError extends Error {
    detail: unknown;
    constructor(message: string, detail?: unknown) {
      super(message);
      this.name = 'TaskBudgetExceededError';
      this.detail = detail;
    }
  },
  TaskCancelledError: class TaskCancelledError extends Error {
    constructor(taskId: string) {
      super(`Task ${taskId} cancelled`);
      this.name = 'TaskCancelledError';
    }
  }
}));

vi.mock('../../../../../../src/bridges/supervisor-runtime-bridge', () => ({
  initializeTaskExecutionSteps: vi.fn()
}));

vi.mock(
  '../../../../../../src/graphs/main/execution/orchestration/pipeline/main-graph-pipeline-orchestrator-graph',
  () => ({
    buildDirectReplyGraphRunner: vi.fn(() => ({
      invoke: vi.fn().mockResolvedValue({})
    })),
    buildTaskPipelineRunner: vi.fn(() => ({
      invoke: vi.fn().mockResolvedValue({})
    })),
    createPipelineMinistries: vi.fn(() => ({
      libu: { finalize: vi.fn() },
      hubu: { research: vi.fn() },
      gongbu: { execute: vi.fn() },
      bingbu: { execute: vi.fn() },
      xingbu: { review: vi.fn() },
      libuDocs: { review: vi.fn(), execute: vi.fn() }
    })),
    resumeGraphWithCommand: vi.fn().mockResolvedValue(undefined)
  })
);

import {
  runTaskPipelineWithGraph,
  runApprovalRecoveryPipelineWithGraph
} from '../../../../../../src/graphs/main/execution/orchestration/pipeline/main-graph-pipeline-orchestrator';

function makeTask(overrides: Record<string, unknown> = {}): any {
  return {
    id: 'task-1',
    status: TaskStatus.RUNNING,
    goal: 'test goal',
    chatRoute: undefined,
    skillStage: undefined,
    currentNode: undefined,
    result: undefined,
    updatedAt: '2026-05-10T00:00:00.000Z',
    resolvedWorkflow: { displayName: 'general' },
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
    updateBudgetState: vi.fn(),
    transitionQueueState: vi.fn(),
    recordDispatches: vi.fn(),
    resolveWorkflowRoutes: vi.fn(),
    resolveResearchMinistry: vi.fn(),
    resolveExecutionMinistry: vi.fn(),
    resolveReviewMinistry: vi.fn(),
    getMinistryLabel: vi.fn(),
    describeActionIntent: vi.fn(),
    createAgentContext: vi.fn(),
    reviewExecution: vi.fn(),
    persistReviewArtifacts: vi.fn(),
    enqueueTaskLearning: vi.fn(),
    shouldRunLibuDocsDelivery: vi.fn(),
    buildFreshnessSourceSummary: vi.fn(),
    buildCitationSourceSummary: vi.fn(),
    appendDiagnosisEvidence: vi.fn(),
    resolveRuntimeSkillIntervention: vi.fn(),
    resolveSkillInstallInterruptResume: vi.fn(),
    createGraphStartState: vi.fn(() => ({})),
    resolveGraphThreadId: vi.fn(() => 'thread-1'),
    getGraphCheckpointer: vi.fn(),
    getGraphStore: vi.fn(),
    runDirectReplyTask: vi.fn(),
    recordAgentError: vi.fn(),
    resolveTaskFlow: vi.fn(() => ({
      flow: 'full-pipeline',
      adapter: 'default',
      priority: 50,
      reason: 'default',
      graph: 'main'
    })),
    ...overrides
  };
}

describe('runTaskPipelineWithGraph', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('runs full pipeline for initial mode', async () => {
    const task = makeTask();
    const callbacks = makeCallbacks();

    await runTaskPipelineWithGraph({
      task,
      dto: { goal: 'test goal' } as any,
      options: { mode: 'initial' },
      pendingExecutions: new Map(),
      llmConfigured: true,
      sourcePolicyMode: undefined,
      callbacks
    });

    expect(task.status).toBe(TaskStatus.RUNNING);
    expect(task.skillStage).toBe('preset_plan_expansion');
    expect(callbacks.persistAndEmitTask).toHaveBeenCalled();
  });

  it('runs direct-reply flow when route is direct-reply', async () => {
    const task = makeTask();
    const callbacks = makeCallbacks({
      resolveTaskFlow: vi.fn(() => ({
        flow: 'direct-reply',
        adapter: 'direct',
        priority: 100,
        reason: 'simple question',
        graph: 'direct-reply'
      }))
    });

    await runTaskPipelineWithGraph({
      task,
      dto: { goal: 'simple question' } as any,
      options: { mode: 'initial' },
      pendingExecutions: new Map(),
      llmConfigured: true,
      sourcePolicyMode: undefined,
      callbacks
    });

    expect(callbacks.persistAndEmitTask).toHaveBeenCalled();
  });

  it('handles interrupt_resume mode', async () => {
    const task = makeTask({
      activeInterrupt: {
        id: 'int-1',
        payload: { stage: 'research' }
      }
    });
    const callbacks = makeCallbacks();

    await runTaskPipelineWithGraph({
      task,
      dto: { goal: 'test goal' } as any,
      options: {
        mode: 'interrupt_resume',
        resume: { action: 'approve' }
      },
      pendingExecutions: new Map(),
      llmConfigured: true,
      sourcePolicyMode: undefined,
      callbacks
    });

    expect(callbacks.persistAndEmitTask).toHaveBeenCalled();
  });

  it('handles direct_reply interrupt resume', async () => {
    const task = makeTask({
      activeInterrupt: {
        id: 'int-1',
        payload: { stage: 'direct_reply' }
      }
    });
    const callbacks = makeCallbacks();

    await runTaskPipelineWithGraph({
      task,
      dto: { goal: 'test goal' } as any,
      options: {
        mode: 'interrupt_resume',
        resume: { action: 'approve' }
      },
      pendingExecutions: new Map(),
      llmConfigured: true,
      sourcePolicyMode: undefined,
      callbacks
    });

    expect(callbacks.persistAndEmitTask).toHaveBeenCalled();
  });

  it('handles TaskCancelledError gracefully', async () => {
    const { TaskCancelledError } =
      await import('../../../../../../src/graphs/main/tasking/runtime/main-graph-task-runtime-errors');
    const task = makeTask();
    const callbacks = makeCallbacks({
      ensureTaskNotCancelled: vi.fn(() => {
        throw new TaskCancelledError('task-1');
      })
    });

    // Should not throw
    await runTaskPipelineWithGraph({
      task,
      dto: { goal: 'test goal' } as any,
      options: { mode: 'initial' },
      pendingExecutions: new Map(),
      llmConfigured: true,
      sourcePolicyMode: undefined,
      callbacks
    });

    expect(callbacks.persistAndEmitTask).toHaveBeenCalled();
  });

  it('handles TaskBudgetExceededError', async () => {
    const { TaskBudgetExceededError } =
      await import('../../../../../../src/graphs/main/tasking/runtime/main-graph-task-runtime-errors');
    const task = makeTask();
    const callbacks = makeCallbacks({
      ensureTaskNotCancelled: vi.fn(() => {
        throw new TaskBudgetExceededError('Budget exceeded');
      })
    });

    await runTaskPipelineWithGraph({
      task,
      dto: { goal: 'test goal' } as any,
      options: { mode: 'initial' },
      pendingExecutions: new Map(),
      llmConfigured: true,
      sourcePolicyMode: undefined,
      callbacks
    });

    expect(task.status).toBe(TaskStatus.BLOCKED);
    expect(task.currentStep).toBe('budget_exhausted');
  });

  it('handles generic errors by setting task to FAILED', async () => {
    const task = makeTask();
    const callbacks = makeCallbacks({
      ensureTaskNotCancelled: vi.fn(() => {
        throw new Error('generic error');
      })
    });

    await expect(
      runTaskPipelineWithGraph({
        task,
        dto: { goal: 'test goal' } as any,
        options: { mode: 'initial' },
        pendingExecutions: new Map(),
        llmConfigured: true,
        sourcePolicyMode: undefined,
        callbacks
      })
    ).rejects.toThrow('generic error');

    expect(task.status).toBe(TaskStatus.FAILED);
    expect(task.currentStep).toBe('agent_error');
  });
});

describe('runApprovalRecoveryPipelineWithGraph', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('runs approval recovery pipeline', async () => {
    const task = makeTask();
    const callbacks = {
      runApprovalRecoveryPipeline: vi.fn().mockResolvedValue(undefined),
      persistAndEmitTask: vi.fn().mockResolvedValue(undefined),
      recordAgentError: vi.fn(),
      transitionQueueState: vi.fn()
    };

    await runApprovalRecoveryPipelineWithGraph({
      task,
      dto: { goal: 'test goal' } as any,
      pending: { toolName: 'test', intent: 'execute', receiptId: 'r-1', kind: 'tool_execution', goal: 'test' } as any,
      callbacks
    });

    expect(callbacks.runApprovalRecoveryPipeline).toHaveBeenCalled();
  });

  it('handles TaskCancelledError gracefully', async () => {
    const { TaskCancelledError } =
      await import('../../../../../../src/graphs/main/tasking/runtime/main-graph-task-runtime-errors');
    const task = makeTask();
    const callbacks = {
      runApprovalRecoveryPipeline: vi.fn().mockRejectedValue(new TaskCancelledError('task-1')),
      persistAndEmitTask: vi.fn().mockResolvedValue(undefined),
      recordAgentError: vi.fn(),
      transitionQueueState: vi.fn()
    };

    await runApprovalRecoveryPipelineWithGraph({
      task,
      dto: { goal: 'test goal' } as any,
      pending: { toolName: 'test', intent: 'execute' } as any,
      callbacks
    });

    expect(callbacks.persistAndEmitTask).toHaveBeenCalled();
    expect(task.status).not.toBe(TaskStatus.FAILED);
  });

  it('sets task to FAILED on generic error', async () => {
    const task = makeTask();
    const callbacks = {
      runApprovalRecoveryPipeline: vi.fn().mockRejectedValue(new Error('recovery failed')),
      persistAndEmitTask: vi.fn().mockResolvedValue(undefined),
      recordAgentError: vi.fn(),
      transitionQueueState: vi.fn()
    };

    await expect(
      runApprovalRecoveryPipelineWithGraph({
        task,
        dto: { goal: 'test goal' } as any,
        pending: { toolName: 'test', intent: 'execute' } as any,
        callbacks
      })
    ).rejects.toThrow('recovery failed');

    expect(task.status).toBe(TaskStatus.FAILED);
    expect(task.result).toBe('recovery failed');
  });
});
