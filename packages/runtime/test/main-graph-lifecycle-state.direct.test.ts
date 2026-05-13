import { describe, expect, it } from 'vitest';

import {
  listLearningQueueItems,
  enqueueTaskLearningItem
} from '../src/graphs/main/runtime/lifecycle/state/main-graph-lifecycle-state';

function makeTask(overrides: Record<string, unknown> = {}) {
  return {
    id: 'task-1',
    runId: 'run-1',
    trace: [],
    learningEvaluation: undefined,
    review: undefined,
    approvalFeedback: undefined,
    backgroundLearningState: undefined,
    learningQueueItemId: undefined,
    executionPlan: undefined,
    entryDecision: undefined,
    toolUsageSummary: undefined,
    modelRoute: undefined,
    llmUsage: undefined,
    budgetState: undefined,
    result: 'some result',
    ...overrides
  } as any;
}

describe('main-graph-lifecycle-state (direct)', () => {
  describe('listLearningQueueItems', () => {
    it('returns empty array for empty queue', () => {
      expect(listLearningQueueItems(new Map())).toEqual([]);
    });

    it('sorts by priority (high first)', () => {
      const queue = new Map();
      queue.set('a', { id: 'a', priority: 'normal', updatedAt: '2026-01-01T00:00:00Z' });
      queue.set('b', { id: 'b', priority: 'high', updatedAt: '2026-01-01T00:00:00Z' });
      const result = listLearningQueueItems(queue);
      expect(result[0].id).toBe('b');
      expect(result[1].id).toBe('a');
    });

    it('sorts by updatedAt within same priority', () => {
      const queue = new Map();
      queue.set('a', { id: 'a', priority: 'normal', updatedAt: '2026-01-01T00:00:00Z' });
      queue.set('b', { id: 'b', priority: 'normal', updatedAt: '2026-01-02T00:00:00Z' });
      const result = listLearningQueueItems(queue);
      expect(result[0].id).toBe('b');
      expect(result[1].id).toBe('a');
    });

    it('returns all items', () => {
      const queue = new Map();
      queue.set('a', { id: 'a', priority: 'high', updatedAt: '2026-01-01T00:00:00Z' });
      queue.set('b', { id: 'b', priority: 'normal', updatedAt: '2026-01-01T00:00:00Z' });
      queue.set('c', { id: 'c', priority: 'high', updatedAt: '2026-01-02T00:00:00Z' });
      expect(listLearningQueueItems(queue)).toHaveLength(3);
    });
  });

  describe('enqueueTaskLearningItem', () => {
    it('creates queue item with task id', () => {
      const queue = new Map();
      const task = makeTask();
      const item = enqueueTaskLearningItem(queue, task);
      expect(item.taskId).toBe('task-1');
      expect(item.runId).toBe('run-1');
      expect(item.status).toBe('queued');
    });

    it('adds item to queue map', () => {
      const queue = new Map();
      const task = makeTask();
      const item = enqueueTaskLearningItem(queue, task);
      expect(queue.has(item.id)).toBe(true);
    });

    it('sets task.learningQueueItemId', () => {
      const queue = new Map();
      const task = makeTask();
      enqueueTaskLearningItem(queue, task);
      expect(task.learningQueueItemId).toBeDefined();
    });

    it('sets task.backgroundLearningState', () => {
      const queue = new Map();
      const task = makeTask();
      enqueueTaskLearningItem(queue, task);
      expect(task.backgroundLearningState).toBeDefined();
      expect(task.backgroundLearningState.status).toBe('queued');
    });

    it('sets priority to high when review is blocked', () => {
      const queue = new Map();
      const task = makeTask({ review: { decision: 'blocked' } });
      const item = enqueueTaskLearningItem(queue, task);
      expect(item.priority).toBe('high');
    });

    it('sets priority to high when evaluation score >= 80', () => {
      const queue = new Map();
      const task = makeTask({ learningEvaluation: { score: 85 } });
      const item = enqueueTaskLearningItem(queue, task);
      expect(item.priority).toBe('high');
    });

    it('sets priority to normal by default', () => {
      const queue = new Map();
      const task = makeTask();
      const item = enqueueTaskLearningItem(queue, task);
      expect(item.priority).toBe('normal');
    });

    it('sets reason to blocked_review when review is blocked', () => {
      const queue = new Map();
      const task = makeTask({ review: { decision: 'blocked' } });
      const item = enqueueTaskLearningItem(queue, task);
      expect(item.reason).toBe('blocked_review');
    });

    it('sets reason to rollback when approvalFeedback present', () => {
      const queue = new Map();
      const task = makeTask({ approvalFeedback: 'rejected' });
      const item = enqueueTaskLearningItem(queue, task);
      expect(item.reason).toBe('rollback');
    });

    it('sets reason to timeout_defaulted when timeoutStats present', () => {
      const queue = new Map();
      const task = makeTask({ learningEvaluation: { timeoutStats: { defaultAppliedCount: 1 } } });
      const item = enqueueTaskLearningItem(queue, task);
      expect(item.reason).toBe('timeout_defaulted');
    });

    it('sets reason to normal by default', () => {
      const queue = new Map();
      const task = makeTask();
      const item = enqueueTaskLearningItem(queue, task);
      expect(item.reason).toBe('normal');
    });

    it('includes userFeedback', () => {
      const queue = new Map();
      const task = makeTask();
      const item = enqueueTaskLearningItem(queue, task, 'user said good job');
      expect(item.userFeedback).toBe('user said good job');
    });

    it('uses custom itemId', () => {
      const queue = new Map();
      const task = makeTask();
      const item = enqueueTaskLearningItem(queue, task, undefined, { itemId: 'custom-id' });
      expect(item.id).toBe('custom-id');
    });

    it('uses dream-task mode when specified', () => {
      const queue = new Map();
      const task = makeTask();
      const item = enqueueTaskLearningItem(queue, task, undefined, { mode: 'dream-task' });
      expect(item.mode).toBe('dream-task');
      expect(item.id).toContain('dream_learning_queue');
    });

    it('uses backgroundLearningState mode when available', () => {
      const queue = new Map();
      const task = makeTask({ backgroundLearningState: { mode: 'dream-task' } });
      const item = enqueueTaskLearningItem(queue, task);
      expect(item.mode).toBe('dream-task');
    });

    it('includes capabilityUsageStats', () => {
      const queue = new Map();
      const task = makeTask({
        toolUsageSummary: [{ toolName: 'bash' }],
        modelRoute: [{ workerId: 'w1' }, { workerId: 'w2' }],
        llmUsage: { totalTokens: 1000 },
        budgetState: { costConsumedUsd: 0.05 }
      });
      const item = enqueueTaskLearningItem(queue, task);
      expect(item.capabilityUsageStats.toolCount).toBe(1);
      expect(item.capabilityUsageStats.workerCount).toBe(2);
      expect(item.capabilityUsageStats.totalTokens).toBe(1000);
    });
  });
});
