import { describe, expect, it, vi } from 'vitest';

import { MainGraphTaskContextRuntime } from '../../../../../src/graphs/main/tasking/context/main-graph-task-context';
import {
  recordTaskUsage,
  recordTaskUsageFromInvocation
} from '../../../../../src/graphs/main/tasking/context/main-graph-task-context-usage';

const createTask = () =>
  ({
    id: 'task-1',
    sessionId: 'session-1',
    status: 'running',
    trace: [],
    llmUsage: {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      estimated: false,
      measuredCallCount: 0,
      estimatedCallCount: 0,
      models: [],
      updatedAt: '2026-04-23T00:00:00.000Z'
    },
    budgetState: {
      tokenBudget: 1000,
      tokenConsumed: 0,
      costBudgetUsd: 10,
      costConsumedUsd: 0,
      costConsumedCny: 0,
      softBudgetThreshold: 0.8,
      hardBudgetThreshold: 1,
      budgetInterruptState: {
        status: 'idle'
      },
      overBudget: false
    }
  }) as any;

const createDeps = (task: any) => {
  const tasks = new Map([[task.id, task]]);
  const persistAndEmitTask = vi.fn().mockResolvedValue(undefined);
  const addTrace = vi.fn();

  return {
    tasks,
    addTrace,
    persistAndEmitTask,
    updateBudgetState: vi.fn((currentTask: any, overrides: Record<string, unknown>) => ({
      ...currentTask.budgetState,
      ...overrides
    }))
  };
};

describe('main graph task context usage bridge', () => {
  it('deduplicates repeated invocation bridge payloads for the same invocationId', () => {
    const task = createTask();
    const deps = createDeps(task);

    const payload = {
      invocationUsageRecord: {
        invocationId: 'invoke-dedupe-1',
        taskId: task.id,
        sessionId: task.sessionId,
        modeProfile: 'runtime-task',
        stage: 'main',
        providerId: 'openai-responses',
        modelId: 'gpt-4.1',
        promptTokens: 20,
        completionTokens: 5,
        totalTokens: 25,
        costUsd: 0.09,
        costCny: 0.64,
        selectedSkills: [],
        selectedTools: [],
        selectedMcpCapabilities: [],
        cacheHit: false,
        fallback: false,
        retry: 0
      },
      taskUsageDelta: {
        taskId: task.id,
        sessionId: task.sessionId,
        invocationId: 'invoke-dedupe-1',
        tokenDelta: 25,
        costUsdDelta: 0.09,
        costCnyDelta: 0.64,
        totalTokenConsumed: 25,
        totalCostConsumedUsd: 0.09,
        totalCostConsumedCny: 0.64
      }
    };

    recordTaskUsageFromInvocation(deps, task.id, payload);
    recordTaskUsageFromInvocation(deps, task.id, payload);

    expect(task.llmUsage).toEqual(
      expect.objectContaining({
        promptTokens: 20,
        completionTokens: 5,
        totalTokens: 25,
        measuredCallCount: 1
      })
    );
    expect(task.budgetState).toEqual(
      expect.objectContaining({
        tokenConsumed: 25,
        costConsumedUsd: 0.09,
        costConsumedCny: 0.64
      })
    );
    expect(deps.persistAndEmitTask).toHaveBeenCalledTimes(1);
  });

  it('applies delta-only invocation bridge payloads to budgetState while leaving llmUsage unchanged', () => {
    const task = createTask();
    const deps = createDeps(task);

    recordTaskUsageFromInvocation(deps, task.id, {
      taskUsageDelta: {
        taskId: task.id,
        sessionId: task.sessionId,
        invocationId: 'invoke-delta-only',
        tokenDelta: 21,
        costUsdDelta: 0.07,
        costCnyDelta: 0.5,
        totalTokenConsumed: 21,
        totalCostConsumedUsd: 0.07,
        totalCostConsumedCny: 0.5
      }
    });

    expect(task.budgetState).toEqual(
      expect.objectContaining({
        tokenConsumed: 21,
        costConsumedUsd: 0.07,
        costConsumedCny: 0.5
      })
    );
    expect(task.llmUsage).toEqual({
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      estimated: false,
      measuredCallCount: 0,
      estimatedCallCount: 0,
      models: [],
      updatedAt: '2026-04-23T00:00:00.000Z'
    });
  });

  it('ignores repeated or stale delta-only totals so they do not overwrite newer budget projections', () => {
    const task = createTask();
    const deps = createDeps(task);

    recordTaskUsageFromInvocation(deps, task.id, {
      taskUsageDelta: {
        taskId: task.id,
        sessionId: task.sessionId,
        invocationId: 'invoke-delta-newer',
        tokenDelta: 40,
        costUsdDelta: 0.2,
        costCnyDelta: 1.4,
        totalTokenConsumed: 40,
        totalCostConsumedUsd: 0.2,
        totalCostConsumedCny: 1.4
      }
    });
    recordTaskUsageFromInvocation(deps, task.id, {
      taskUsageDelta: {
        taskId: task.id,
        sessionId: task.sessionId,
        invocationId: 'invoke-delta-newer',
        tokenDelta: 40,
        costUsdDelta: 0.2,
        costCnyDelta: 1.4,
        totalTokenConsumed: 40,
        totalCostConsumedUsd: 0.2,
        totalCostConsumedCny: 1.4
      }
    });
    recordTaskUsageFromInvocation(deps, task.id, {
      taskUsageDelta: {
        taskId: task.id,
        sessionId: task.sessionId,
        invocationId: 'invoke-delta-older',
        tokenDelta: 15,
        costUsdDelta: 0.08,
        costCnyDelta: 0.5,
        totalTokenConsumed: 15,
        totalCostConsumedUsd: 0.08,
        totalCostConsumedCny: 0.5
      }
    });

    expect(task.budgetState).toEqual(
      expect.objectContaining({
        tokenConsumed: 40,
        costConsumedUsd: 0.2,
        costConsumedCny: 1.4
      })
    );
    expect(task.llmUsage).toEqual({
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      estimated: false,
      measuredCallCount: 0,
      estimatedCallCount: 0,
      models: [],
      updatedAt: '2026-04-23T00:00:00.000Z'
    });
    expect(deps.persistAndEmitTask).toHaveBeenCalledTimes(1);
  });

  it('projects invocation usage records into task llmUsage and budget compatibility fields', () => {
    const task = createTask();
    const deps = createDeps(task);

    recordTaskUsageFromInvocation(deps, task.id, {
      invocationUsageRecord: {
        invocationId: 'invoke-1',
        taskId: task.id,
        sessionId: task.sessionId,
        modeProfile: 'runtime-task',
        stage: 'main',
        providerId: 'openai-responses',
        modelId: 'gpt-4.1',
        promptTokens: 40,
        completionTokens: 12,
        totalTokens: 52,
        costUsd: 0.13,
        costCny: 0.94,
        selectedSkills: [],
        selectedTools: [],
        selectedMcpCapabilities: [],
        cacheHit: false,
        fallback: false,
        retry: 0
      },
      taskUsageDelta: {
        taskId: task.id,
        sessionId: task.sessionId,
        invocationId: 'invoke-1',
        tokenDelta: 52,
        costUsdDelta: 0.13,
        costCnyDelta: 0.94,
        totalTokenConsumed: 52,
        totalCostConsumedUsd: 0.13,
        totalCostConsumedCny: 0.94
      }
    });

    expect(task.llmUsage).toEqual(
      expect.objectContaining({
        promptTokens: 40,
        completionTokens: 12,
        totalTokens: 52,
        measuredCallCount: 1,
        estimatedCallCount: 0,
        estimated: false,
        models: [
          expect.objectContaining({
            model: 'gpt-4.1',
            promptTokens: 40,
            completionTokens: 12,
            totalTokens: 52,
            costUsd: 0.13,
            costCny: 0.94,
            pricingSource: 'provider',
            callCount: 1
          })
        ]
      })
    );
    expect(task.budgetState).toEqual(
      expect.objectContaining({
        tokenConsumed: 52,
        costConsumedUsd: 0.13,
        costConsumedCny: 0.94
      })
    );
  });

  it('keeps legacy onUsage accumulation while allowing a different invocation bridge payload on the context runtime', () => {
    const task = createTask();
    const deps = createDeps(task);
    const runtime = new MainGraphTaskContextRuntime(
      {
        memoryRepository: {} as any,
        ruleRepository: {} as any,
        runtimeStateRepository: {} as any,
        memorySearchService: {} as any,
        skillRegistry: {} as any,
        approvalService: {} as any,
        mcpClientManager: {} as any,
        sandboxExecutor: {} as any
      },
      {
        zhipuThinking: {
          manager: false,
          research: false,
          executor: false,
          reviewer: false
        },
        contextStrategy: undefined
      } as any,
      {} as any,
      {} as any,
      { get: vi.fn() } as any,
      deps.tasks,
      deps.addTrace,
      deps.updateBudgetState,
      vi.fn(),
      deps.persistAndEmitTask
    );

    const context = runtime.createAgentContext(task.id, 'bridge invocation usage', 'chat') as any;

    context.onUsage({
      role: 'manager',
      usage: {
        promptTokens: 5,
        completionTokens: 3,
        totalTokens: 8,
        model: 'legacy-model'
      }
    });
    context.onInvocationUsage({
      role: 'manager',
      invocationUsageRecord: {
        invocationId: 'invoke-2',
        taskId: task.id,
        sessionId: task.sessionId,
        modeProfile: 'runtime-task',
        stage: 'main',
        providerId: 'openai-responses',
        modelId: 'gpt-4.1-mini',
        promptTokens: 10,
        completionTokens: 6,
        totalTokens: 16,
        costUsd: 0.02,
        costCny: 0.14,
        selectedSkills: [],
        selectedTools: [],
        selectedMcpCapabilities: [],
        cacheHit: false,
        fallback: false,
        retry: 0
      },
      taskUsageDelta: {
        taskId: task.id,
        sessionId: task.sessionId,
        invocationId: 'invoke-2',
        tokenDelta: 16,
        costUsdDelta: 0.02,
        costCnyDelta: 0.14,
        totalTokenConsumed: 24,
        totalCostConsumedUsd: 0.028,
        totalCostConsumedCny: 0.1976
      }
    });

    expect(task.llmUsage).toEqual(
      expect.objectContaining({
        promptTokens: 15,
        completionTokens: 9,
        totalTokens: 24,
        measuredCallCount: 2,
        models: [
          expect.objectContaining({
            model: 'gpt-4.1-mini',
            totalTokens: 16
          }),
          expect.objectContaining({
            model: 'legacy-model',
            totalTokens: 8
          })
        ]
      })
    );
    expect(task.budgetState).toEqual(
      expect.objectContaining({
        tokenConsumed: 24,
        costConsumedUsd: 0.028,
        costConsumedCny: 0.1976
      })
    );
  });
});
