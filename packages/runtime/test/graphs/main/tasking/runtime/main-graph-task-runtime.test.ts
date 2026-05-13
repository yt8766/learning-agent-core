import { describe, expect, it, vi, beforeEach } from 'vitest';

import { TaskStatus } from '@agent/core';

vi.mock('@agent/config', () => ({ loadSettings: vi.fn(() => ({})) }));
vi.mock('@agent/tools', () => ({
  McpClientManager: class {},
  ToolRegistry: class {}
}));
vi.mock('../../../../../src/capabilities/capability-pool', () => ({
  buildWorkerSelectionPreferences: vi.fn(() => ({}))
}));
vi.mock('../../../../../src/capabilities/capability-pool.shared', () => ({
  normalizeMinistryId: vi.fn((id: string) => id)
}));
vi.mock('../../../../../src/governance/worker-registry', () => ({
  WorkerRegistry: class {
    get() {
      return undefined;
    }
  },
  WorkerSelectionConstraints: {}
}));
vi.mock('../../../../../src/governance/model-routing-policy', () => ({
  ModelRoutingPolicy: class {
    resolveRoute() {
      return undefined;
    }
  }
}));
vi.mock('../../../../../src/governance/profile-policy', () => ({
  describeConnectorProfilePolicy: vi.fn(() => ({ enabledByProfile: true }))
}));
vi.mock('../../../../../src/bridges/supervisor-runtime-bridge', () => ({
  resolveWorkflowRoute: vi.fn(() => ({
    flow: 'full-pipeline',
    adapter: 'default',
    priority: 50,
    reason: 'default',
    graph: 'main'
  }))
}));
vi.mock('../../../../../src/graphs/main/tasking/runtime/main-graph-task-runtime-budget', () => ({
  assertTaskBudgetAllowsProgress: vi.fn(),
  createTaskQueueState: vi.fn((sessionId, now) => ({
    status: 'queued',
    sessionId,
    createdAt: now,
    startedAt: null,
    lastTransitionAt: now
  })),
  estimateRuntimeStepsConsumed: vi.fn(() => 1),
  transitionTaskQueueState: vi.fn(),
  updateTaskBudgetState: vi.fn((task, settings, overrides) => ({
    stepBudget: 8,
    stepsConsumed: 0,
    ...overrides
  }))
}));
vi.mock('../../../../../src/graphs/main/tasking/runtime/main-graph-task-runtime-trace', () => ({
  addRuntimeMessage: vi.fn(),
  addRuntimeProgressDelta: vi.fn(),
  addRuntimeTrace: vi.fn(),
  attachRuntimeTool: vi.fn(),
  recordRuntimeToolUsage: vi.fn(),
  setRuntimeSubTaskStatus: vi.fn(() => true),
  upsertRuntimeAgentState: vi.fn(() => true)
}));
vi.mock('../../../../../src/graphs/main/tasking/runtime/main-graph-task-runtime-errors', () => ({
  TaskBudgetExceededError: class TaskBudgetExceededError extends Error {},
  TaskCancelledError: class TaskCancelledError extends Error {
    constructor(taskId: string) {
      super(`cancelled: ${taskId}`);
    }
  }
}));

import { MainGraphTaskRuntime } from '../../../../../src/graphs/main/tasking/runtime/main-graph-task-runtime';

function makeRuntime(): MainGraphTaskRuntime {
  return new MainGraphTaskRuntime(
    {},
    { profile: 'default', zhipuThinking: { manager: false, research: false, executor: false, reviewer: false } } as any,
    { get: vi.fn() } as any,
    { resolveRoute: vi.fn() } as any,
    new Set(),
    vi.fn()
  );
}

function makeTask(overrides: Record<string, unknown> = {}): any {
  return {
    id: 'task-1',
    status: TaskStatus.RUNNING,
    currentStep: 'research',
    trace: [],
    connectorRefs: [],
    usedCompanyWorkers: [],
    usedInstalledSkills: [],
    subgraphTrail: [],
    budgetState: { stepBudget: 8, stepsConsumed: 0, retryBudget: 2, retriesConsumed: 0 },
    blackboardState: undefined,
    updatedAt: '2026-05-10T00:00:00.000Z',
    externalSources: [],
    dispatches: undefined,
    activeInterrupt: undefined,
    ...overrides
  };
}

describe('MainGraphTaskRuntime', () => {
  let runtime: MainGraphTaskRuntime;

  beforeEach(() => {
    vi.clearAllMocks();
    runtime = makeRuntime();
  });

  describe('markWorkerUsage', () => {
    it('returns early when workerId is undefined', () => {
      const task = makeTask();
      runtime.markWorkerUsage(task, undefined);
      expect(task.connectorRefs).toEqual([]);
    });

    it('returns early when worker not found in registry', () => {
      const task = makeTask();
      runtime.markWorkerUsage(task, 'unknown-worker');
      expect(task.connectorRefs).toEqual([]);
    });
  });

  describe('markSubgraph', () => {
    it('adds subgraph id to trail', () => {
      const task = makeTask();
      runtime.markSubgraph(task, 'research');
      expect(task.subgraphTrail).toContain('research');
    });

    it('does not duplicate subgraph ids', () => {
      const task = makeTask({ subgraphTrail: ['research'] });
      runtime.markSubgraph(task, 'research');
      expect(task.subgraphTrail.filter((s: string) => s === 'research')).toHaveLength(1);
    });
  });

  describe('shouldRunLibuDocsDelivery', () => {
    it('returns false for undefined workflow', () => {
      expect(runtime.shouldRunLibuDocsDelivery(undefined)).toBe(false);
    });

    it('returns true when libu-delivery is in required ministries', () => {
      expect(runtime.shouldRunLibuDocsDelivery({ requiredMinistries: ['libu-delivery'] } as any)).toBe(true);
    });

    it('returns true when libu-docs is in required ministries', () => {
      expect(runtime.shouldRunLibuDocsDelivery({ requiredMinistries: ['libu-docs'] } as any)).toBe(true);
    });

    it('returns false when neither is present', () => {
      expect(runtime.shouldRunLibuDocsDelivery({ requiredMinistries: ['hubu-search'] } as any)).toBe(false);
    });
  });

  describe('resolveTaskFlow', () => {
    it('returns approval-recovery for approval_resume mode', () => {
      const task = makeTask();
      const result = runtime.resolveTaskFlow(task, 'test', 'approval_resume');
      expect(result.flow).toBe('approval');
      expect(result.graph).toBe('approval-recovery');
    });

    it('returns existing chatRoute for initial mode when present', () => {
      const task = makeTask({
        chatRoute: { flow: 'direct-reply', adapter: 'direct', priority: 100, reason: 'simple', graph: 'direct' }
      });
      const result = runtime.resolveTaskFlow(task, 'test', 'initial');
      expect(result.flow).toBe('direct-reply');
    });

    it('resolves workflow route for retry mode', () => {
      const task = makeTask();
      const result = runtime.resolveTaskFlow(task, 'test', 'retry');
      expect(result).toBeDefined();
    });
  });

  describe('syncTaskRuntime', () => {
    it('updates task step and emits update', () => {
      const emitFn = vi.fn();
      const rt = new MainGraphTaskRuntime(
        {},
        {
          profile: 'default',
          zhipuThinking: { manager: false, research: false, executor: false, reviewer: false }
        } as any,
        { get: vi.fn() } as any,
        { resolveRoute: vi.fn() } as any,
        new Set(),
        emitFn
      );
      const task = makeTask();
      rt.syncTaskRuntime(task, { currentStep: 'execute', retryCount: 1, maxRetries: 3 });

      expect(task.currentStep).toBe('execute');
      expect(task.retryCount).toBe(1);
      expect(task.maxRetries).toBe(3);
      expect(task.updatedAt).toBeDefined();
      expect(emitFn).toHaveBeenCalled();
    });
  });

  describe('ensureTaskNotCancelled', () => {
    it('does not throw for running task', () => {
      const task = makeTask();
      expect(() => runtime.ensureTaskNotCancelled(task)).not.toThrow();
    });

    it('throws for cancelled task', () => {
      const cancelledTasks = new Set(['task-1']);
      const rt = new MainGraphTaskRuntime(
        {},
        {
          profile: 'default',
          zhipuThinking: { manager: false, research: false, executor: false, reviewer: false }
        } as any,
        { get: vi.fn() } as any,
        { resolveRoute: vi.fn() } as any,
        cancelledTasks,
        vi.fn()
      );
      const task = makeTask();
      expect(() => rt.ensureTaskNotCancelled(task)).toThrow();
    });

    it('throws for task with CANCELLED status', () => {
      const task = makeTask({ status: TaskStatus.CANCELLED });
      expect(() => runtime.ensureTaskNotCancelled(task)).toThrow();
    });
  });

  describe('transitionQueueState', () => {
    it('delegates to transitionTaskQueueState', () => {
      const task = makeTask();
      runtime.transitionQueueState(task, 'running');
      // Just verifying it doesn't throw
    });
  });

  describe('createQueueState', () => {
    it('creates queue state', () => {
      const result = runtime.createQueueState('sess-1', '2026-05-10');
      expect(result).toBeDefined();
    });
  });

  describe('updateBudgetState', () => {
    it('delegates to updateTaskBudgetState', () => {
      const task = makeTask();
      const result = runtime.updateBudgetState(task, { stepsConsumed: 2 });
      expect(result).toBeDefined();
    });
  });

  describe('recordDispatches', () => {
    it('records dispatches on task', () => {
      const task = makeTask();
      runtime.recordDispatches(task, [{ objective: 'research', to: 'research', selectedAgentId: 'agent-1' }] as any);

      expect(task.dispatches).toHaveLength(1);
    });
  });
});
