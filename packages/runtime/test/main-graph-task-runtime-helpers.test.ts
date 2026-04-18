import { describe, expect, it } from 'vitest';

import {
  assertTaskBudgetAllowsProgress,
  createTaskQueueState,
  estimateRuntimeStepsConsumed,
  transitionTaskQueueState,
  updateTaskBudgetState
} from '../src/graphs/main/tasking/runtime/main-graph-task-runtime-budget';
import { addRuntimeTrace } from '../src/graphs/main/tasking/runtime/main-graph-task-runtime-trace';

describe('main graph task runtime helpers', () => {
  it('marks budget interrupt when soft threshold is crossed', () => {
    const task: any = {
      id: 'task-1',
      sessionId: 'session-1',
      budgetState: {
        tokenBudget: 100,
        tokenConsumed: 79,
        costBudgetUsd: 10,
        costConsumedUsd: 1,
        softBudgetThreshold: 0.8,
        hardBudgetThreshold: 1
      }
    };

    const next = updateTaskBudgetState(task, {}, { tokenConsumed: 85 });

    expect(next.budgetInterruptState?.status).toBe('soft-threshold-triggered');
    expect(task.budgetGateState?.status).toBe('soft_blocked');
  });

  it('throws when steps exceed runtime step budget', () => {
    const task: any = {
      budgetState: {
        stepBudget: 2,
        stepsConsumed: 0
      }
    };

    expect(estimateRuntimeStepsConsumed('execute')).toBe(3);
    expect(() =>
      assertTaskBudgetAllowsProgress(task, {
        currentStep: 'execute',
        retryCount: 0,
        maxRetries: 1
      })
    ).toThrow('step budget');
  });

  it('links later traces to a parent span in the same stage', () => {
    const trace: any[] = [];
    addRuntimeTrace(trace, 'research', '户部开始检索');
    addRuntimeTrace(trace, 'ministry_started', '户部进入执行');

    expect(trace[1]?.parentSpanId).toBe(trace[0]?.spanId);
  });

  it('releases queue lease state after completion', () => {
    const task: any = {
      id: 'task-queue',
      sessionId: 'session-1',
      queueState: {
        ...createTaskQueueState('session-1', '2026-04-16T00:00:00.000Z'),
        status: 'running',
        leaseOwner: 'runtime-runner',
        leaseExpiresAt: '2026-04-16T01:00:00.000Z',
        lastHeartbeatAt: '2026-04-16T00:30:00.000Z'
      }
    };

    transitionTaskQueueState(task, 'completed');

    expect(task.queueState.status).toBe('completed');
    expect(task.queueState.leaseOwner).toBeUndefined();
    expect(task.queueState.leaseExpiresAt).toBeUndefined();
    expect(task.queueState.lastHeartbeatAt).toBeUndefined();
    expect(task.queueState.finishedAt).toBeTypeOf('string');
  });
});
