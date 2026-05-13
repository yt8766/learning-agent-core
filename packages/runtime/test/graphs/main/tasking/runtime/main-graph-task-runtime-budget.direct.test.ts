import { describe, expect, it } from 'vitest';

import {
  updateTaskBudgetState,
  estimateRuntimeStepsConsumed,
  createTaskQueueState,
  transitionTaskQueueState,
  assertTaskBudgetAllowsProgress
} from '../../../../../src/graphs/main/tasking/runtime/main-graph-task-runtime-budget';
import { TaskBudgetExceededError } from '../../../../../src/graphs/main/tasking/runtime/main-graph-task-runtime-errors';

function makeTask(overrides: Record<string, unknown> = {}): any {
  return {
    id: 'task-1',
    sessionId: 'session-1',
    budgetState: undefined,
    queueState: undefined,
    budgetGateState: undefined,
    ...overrides
  };
}

function makeSettings(overrides: Record<string, unknown> = {}): any {
  return {
    policy: {
      budget: {
        stepBudget: 8,
        retryBudget: 1,
        sourceBudget: 8,
        maxCostPerTaskUsd: 1.0,
        fallbackModelId: 'glm-4.6',
        ...overrides
      }
    }
  };
}

describe('main-graph-task-runtime-budget (direct)', () => {
  describe('updateTaskBudgetState', () => {
    it('initializes budget from settings when task has no budgetState', () => {
      const task = makeTask();
      const result = updateTaskBudgetState(task, makeSettings(), {});
      expect(result.stepBudget).toBe(8);
      expect(result.retryBudget).toBe(1);
      expect(result.sourceBudget).toBe(8);
    });

    it('preserves existing budget state', () => {
      const task = makeTask({
        budgetState: { stepBudget: 20, stepsConsumed: 5, tokenBudget: 50000 }
      });
      const result = updateTaskBudgetState(task, makeSettings(), {});
      expect(result.stepBudget).toBe(20);
      expect(result.stepsConsumed).toBe(5);
      expect(result.tokenBudget).toBe(50000);
    });

    it('applies overrides', () => {
      const task = makeTask();
      const result = updateTaskBudgetState(task, makeSettings(), { stepsConsumed: 3 });
      expect(result.stepsConsumed).toBe(3);
    });

    it('triggers hard threshold when token ratio exceeds limit', () => {
      const task = makeTask({
        budgetState: {
          tokenBudget: 100,
          tokenConsumed: 100,
          hardBudgetThreshold: 1
        }
      });
      const result = updateTaskBudgetState(task, makeSettings(), {});
      expect(result.budgetInterruptState.status).toBe('hard-threshold-triggered');
    });

    it('triggers soft threshold when approaching limit', () => {
      const task = makeTask({
        budgetState: {
          tokenBudget: 100,
          tokenConsumed: 85,
          softBudgetThreshold: 0.8,
          hardBudgetThreshold: 1,
          budgetInterruptState: { status: 'idle' }
        }
      });
      const result = updateTaskBudgetState(task, makeSettings(), {});
      expect(result.budgetInterruptState.status).toBe('soft-threshold-triggered');
    });

    it('sets overBudget when cost exceeds limit', () => {
      const task = makeTask({
        budgetState: {
          costBudgetUsd: 1.0,
          costConsumedUsd: 1.5
        }
      });
      const result = updateTaskBudgetState(task, makeSettings(), {});
      expect(result.overBudget).toBe(true);
    });

    it('creates budget gate state with hard_blocked', () => {
      const task = makeTask({
        budgetState: {
          tokenBudget: 100,
          tokenConsumed: 100,
          hardBudgetThreshold: 1
        }
      });
      updateTaskBudgetState(task, makeSettings(), {});
      expect(task.budgetGateState.status).toBe('hard_blocked');
    });

    it('creates budget gate state with soft_blocked', () => {
      const task = makeTask({
        budgetState: {
          tokenBudget: 100,
          tokenConsumed: 85,
          softBudgetThreshold: 0.8,
          hardBudgetThreshold: 1,
          budgetInterruptState: { status: 'idle' }
        }
      });
      updateTaskBudgetState(task, makeSettings(), {});
      expect(task.budgetGateState.status).toBe('soft_blocked');
    });

    it('creates budget gate state with throttled when queued', () => {
      const task = makeTask({
        queueState: { status: 'queued' },
        budgetState: {
          tokenBudget: 100,
          tokenConsumed: 10,
          budgetInterruptState: { status: 'idle' }
        }
      });
      updateTaskBudgetState(task, makeSettings(), {});
      expect(task.budgetGateState.status).toBe('throttled');
    });

    it('creates budget gate state with open when normal', () => {
      const task = makeTask({
        budgetState: {
          tokenBudget: 100,
          tokenConsumed: 10,
          budgetInterruptState: { status: 'idle' }
        }
      });
      updateTaskBudgetState(task, makeSettings(), {});
      expect(task.budgetGateState.status).toBe('open');
    });
  });

  describe('estimateRuntimeStepsConsumed', () => {
    it('returns 1 for manager_plan', () => {
      expect(estimateRuntimeStepsConsumed('manager_plan')).toBe(1);
    });

    it('returns 2 for research', () => {
      expect(estimateRuntimeStepsConsumed('research')).toBe(2);
    });

    it('returns 3 for execute', () => {
      expect(estimateRuntimeStepsConsumed('execute')).toBe(3);
    });

    it('returns 4 for review', () => {
      expect(estimateRuntimeStepsConsumed('review')).toBe(4);
    });

    it('returns 0 for unknown step', () => {
      expect(estimateRuntimeStepsConsumed('unknown')).toBe(0);
    });

    it('returns 0 for undefined', () => {
      expect(estimateRuntimeStepsConsumed(undefined)).toBe(0);
    });
  });

  describe('createTaskQueueState', () => {
    it('creates foreground queue state with session id', () => {
      const result = createTaskQueueState('session-1', '2026-01-01T00:00:00Z');
      expect(result.mode).toBe('foreground');
      expect(result.backgroundRun).toBe(false);
      expect(result.status).toBe('queued');
    });

    it('creates background queue state without session id', () => {
      const result = createTaskQueueState(undefined, '2026-01-01T00:00:00Z');
      expect(result.mode).toBe('background');
      expect(result.backgroundRun).toBe(true);
    });
  });

  describe('transitionTaskQueueState', () => {
    it('transitions to running', () => {
      const task = makeTask({ queueState: { status: 'queued', enqueuedAt: '2026-01-01T00:00:00Z' } });
      transitionTaskQueueState(task, 'running');
      expect(task.queueState.status).toBe('running');
      expect(task.queueState.startedAt).toBeDefined();
    });

    it('transitions to completed', () => {
      const task = makeTask({
        queueState: { status: 'running', startedAt: '2026-01-01T00:00:00Z', leaseOwner: 'owner' }
      });
      transitionTaskQueueState(task, 'completed');
      expect(task.queueState.status).toBe('completed');
      expect(task.queueState.finishedAt).toBeDefined();
      expect(task.queueState.leaseOwner).toBeUndefined();
    });

    it('transitions to failed', () => {
      const task = makeTask({ queueState: { status: 'running' } });
      transitionTaskQueueState(task, 'failed');
      expect(task.queueState.finishedAt).toBeDefined();
    });

    it('transitions to cancelled', () => {
      const task = makeTask({ queueState: { status: 'running' } });
      transitionTaskQueueState(task, 'cancelled');
      expect(task.queueState.finishedAt).toBeDefined();
    });

    it('creates queue state if none exists', () => {
      const task = makeTask({ queueState: undefined });
      transitionTaskQueueState(task, 'running');
      expect(task.queueState.status).toBe('running');
    });

    it('preserves startedAt when already set', () => {
      const task = makeTask({
        queueState: { status: 'queued', startedAt: '2026-01-01T00:00:00Z' }
      });
      transitionTaskQueueState(task, 'running');
      expect(task.queueState.startedAt).toBe('2026-01-01T00:00:00Z');
    });
  });

  describe('assertTaskBudgetAllowsProgress', () => {
    it('does not throw when within budget', () => {
      const task = makeTask({
        budgetState: { stepBudget: 10, stepsConsumed: 3, budgetInterruptState: { status: 'idle' } }
      });
      expect(() =>
        assertTaskBudgetAllowsProgress(task, { currentStep: 'research', retryCount: 0, maxRetries: 1 })
      ).not.toThrow();
    });

    it('throws when step budget exceeded', () => {
      const task = makeTask({
        budgetState: { stepBudget: 2, stepsConsumed: 3 }
      });
      expect(() =>
        assertTaskBudgetAllowsProgress(task, { currentStep: 'execute', retryCount: 0, maxRetries: 1 })
      ).toThrow(TaskBudgetExceededError);
    });

    it('throws when hard threshold triggered', () => {
      const task = makeTask({
        budgetState: {
          budgetInterruptState: { status: 'hard-threshold-triggered', reason: 'Budget exceeded' }
        }
      });
      expect(() =>
        assertTaskBudgetAllowsProgress(task, { currentStep: 'execute', retryCount: 0, maxRetries: 1 })
      ).toThrow('Budget exceeded');
    });

    it('does not throw when soft threshold triggered', () => {
      const task = makeTask({
        budgetState: { stepBudget: 10, stepsConsumed: 3, budgetInterruptState: { status: 'soft-threshold-triggered' } }
      });
      expect(() =>
        assertTaskBudgetAllowsProgress(task, { currentStep: 'research', retryCount: 0, maxRetries: 1 })
      ).not.toThrow();
    });
  });
});
