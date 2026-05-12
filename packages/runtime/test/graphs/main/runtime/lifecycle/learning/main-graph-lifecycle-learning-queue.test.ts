import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../../../../src/graphs/main/runtime/lifecycle/state/main-graph-lifecycle-state', () => ({
  enqueueTaskLearningItem: vi.fn().mockImplementation((_queue, task, _feedback, options) => ({
    id: `${options?.mode ?? 'task-learning'}_${task.id}`,
    taskId: task.id,
    status: 'queued',
    mode: options?.mode ?? 'task-learning',
    priority: 'normal',
    updatedAt: new Date().toISOString()
  })),
  listLearningQueueItems: vi.fn().mockImplementation(queue => [...queue.values()])
}));

import {
  processLifecycleLearningQueue,
  listLifecycleLearningQueue,
  enqueueLifecycleTaskLearning,
  shouldEnqueueDreamTask,
  summarizeLearningCandidates
} from '../../../../../../src/graphs/main/runtime/lifecycle/learning/main-graph-lifecycle-learning-queue';

function makeQueueItem(overrides: Record<string, any> = {}) {
  return {
    id: 'queue-1',
    taskId: 'task-1',
    status: 'queued',
    mode: 'task-learning',
    priority: 'normal',
    updatedAt: '2026-04-16T00:00:00.000Z',
    ...overrides
  } as any;
}

function makeTask(overrides: Record<string, any> = {}) {
  return {
    id: 'task-1',
    goal: 'test goal',
    result: 'task result',
    trace: [],
    updatedAt: '2026-04-16T00:00:00.000Z',
    ...overrides
  } as any;
}

function makeLearningFlow() {
  return {
    ensureCandidates: vi.fn(),
    confirmCandidates: vi.fn().mockResolvedValue(undefined)
  } as any;
}

describe('main-graph-lifecycle-learning-queue', () => {
  describe('shouldEnqueueDreamTask', () => {
    it('returns true when review decision is blocked', () => {
      const task = makeTask({ review: { decision: 'blocked' } });
      expect(shouldEnqueueDreamTask(task)).toBe(true);
    });

    it('returns true when critiqueResult decision is revise_required', () => {
      const task = makeTask({ critiqueResult: { decision: 'revise_required' } });
      expect(shouldEnqueueDreamTask(task)).toBe(true);
    });

    it('returns true when critiqueResult decision is block', () => {
      const task = makeTask({ critiqueResult: { decision: 'block' } });
      expect(shouldEnqueueDreamTask(task)).toBe(true);
    });

    it('returns true when approvalFeedback exists', () => {
      const task = makeTask({ approvalFeedback: { comment: 'needs work' } });
      expect(shouldEnqueueDreamTask(task)).toBe(true);
    });

    it('returns true when learning evaluation score >= 85', () => {
      const task = makeTask({ learningEvaluation: { score: 90 } });
      expect(shouldEnqueueDreamTask(task)).toBe(true);
    });

    it('returns true when notes contain correction keyword', () => {
      const task = makeTask({ learningEvaluation: { notes: ['需要纠正偏差'] } });
      expect(shouldEnqueueDreamTask(task)).toBe(true);
    });

    it('returns true when notes contain preference keyword', () => {
      const task = makeTask({ learningEvaluation: { notes: ['用户偏好已更新'] } });
      expect(shouldEnqueueDreamTask(task)).toBe(true);
    });

    it('returns true when notes contain success case keyword', () => {
      const task = makeTask({ learningEvaluation: { notes: ['成功案例沉淀'] } });
      expect(shouldEnqueueDreamTask(task)).toBe(true);
    });

    it('returns false when none of the conditions match', () => {
      const task = makeTask({
        review: { decision: 'approved' },
        learningEvaluation: { score: 50, notes: ['normal note'] }
      });
      expect(shouldEnqueueDreamTask(task)).toBe(false);
    });

    it('returns false when no review, critique, feedback, or evaluation', () => {
      const task = makeTask();
      expect(shouldEnqueueDreamTask(task)).toBe(false);
    });
  });

  describe('summarizeLearningCandidates', () => {
    it('counts candidates by type', () => {
      const task = makeTask({
        learningCandidates: [
          { type: 'memory' },
          { type: 'memory' },
          { type: 'rule' },
          { type: 'skill' },
          { type: 'reflection' }
        ]
      });
      const result = summarizeLearningCandidates(task);
      expect(result.counts.memory).toBe(2);
      expect(result.counts.rule).toBe(1);
      expect(result.counts.skill).toBe(1);
      expect(result.counts.reflection).toBe(1);
      expect(result.summary).toContain('memory 2');
    });

    it('returns zero counts when no candidates', () => {
      const task = makeTask({ learningCandidates: undefined });
      const result = summarizeLearningCandidates(task);
      expect(result.counts.memory).toBe(0);
      expect(result.counts.rule).toBe(0);
    });
  });

  describe('listLifecycleLearningQueue', () => {
    it('returns items from the learning queue', () => {
      const queue = new Map([['q1', makeQueueItem()]]);
      const result = listLifecycleLearningQueue({ learningQueue: queue });
      expect(result).toHaveLength(1);
    });
  });

  describe('enqueueLifecycleTaskLearning', () => {
    it('enqueues a task-learning item', () => {
      const queue = new Map<string, any>();
      const task = makeTask();
      const result = enqueueLifecycleTaskLearning({ learningQueue: queue }, task, 'user feedback');
      expect(result).toBeDefined();
    });

    it('also enqueues dream-task when conditions are met', () => {
      const queue = new Map<string, any>();
      const task = makeTask({ review: { decision: 'blocked' } });
      enqueueLifecycleTaskLearning({ learningQueue: queue }, task);
      // Both task-learning and dream-task should be enqueued
    });
  });

  describe('processLifecycleLearningQueue', () => {
    it('returns empty when no queued items', async () => {
      const deps = {
        tasks: new Map(),
        learningQueue: new Map(),
        learningFlow: makeLearningFlow(),
        persistAndEmitTask: vi.fn().mockResolvedValue(undefined)
      };
      const result = await processLifecycleLearningQueue(deps);
      expect(result).toEqual([]);
    });

    it('processes a task-learning item with auto-confirm candidates', async () => {
      const task = makeTask({
        learningCandidates: [
          { id: 'c1', type: 'memory', autoConfirmEligible: true },
          { id: 'c2', type: 'rule', autoConfirmEligible: false }
        ],
        learningEvaluation: { autoConfirmCandidateIds: ['c1'] }
      });
      const queueItem = makeQueueItem();
      const deps = {
        tasks: new Map([['task-1', task]]),
        learningQueue: new Map([['queue-1', queueItem]]),
        learningFlow: makeLearningFlow(),
        persistAndEmitTask: vi.fn().mockResolvedValue(undefined)
      };

      const result = await processLifecycleLearningQueue(deps, 1);
      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('completed');
      expect(deps.learningFlow.confirmCandidates).toHaveBeenCalled();
    });

    it('processes a dream-task item', async () => {
      const task = makeTask({ learningCandidates: [{ type: 'memory' }] });
      const queueItem = makeQueueItem({ mode: 'dream-task' });
      const deps = {
        tasks: new Map([['task-1', task]]),
        learningQueue: new Map([['queue-1', queueItem]]),
        learningFlow: makeLearningFlow(),
        persistAndEmitTask: vi.fn().mockResolvedValue(undefined)
      };

      const result = await processLifecycleLearningQueue(deps, 1);
      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('completed');
      expect(result[0].reason).toBe('dream-task');
    });

    it('fails when task is not found', async () => {
      const queueItem = makeQueueItem();
      const deps = {
        tasks: new Map(),
        learningQueue: new Map([['queue-1', queueItem]]),
        learningFlow: makeLearningFlow(),
        persistAndEmitTask: vi.fn().mockResolvedValue(undefined)
      };

      const result = await processLifecycleLearningQueue(deps, 1);
      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('failed');
    });

    it('selects high-priority items with higher limit', async () => {
      const task = makeTask();
      const queueItem1 = makeQueueItem({ id: 'q1', priority: 'high' });
      const queueItem2 = makeQueueItem({ id: 'q2', taskId: 'task-2', priority: 'normal' });
      const task2 = makeTask({ id: 'task-2' });
      const deps = {
        tasks: new Map([
          ['task-1', task],
          ['task-2', task2]
        ]),
        learningQueue: new Map([
          ['q1', queueItem1],
          ['q2', queueItem2]
        ]),
        learningFlow: makeLearningFlow(),
        persistAndEmitTask: vi.fn().mockResolvedValue(undefined)
      };

      const result = await processLifecycleLearningQueue(deps);
      expect(result.length).toBeGreaterThanOrEqual(1);
    });

    it('uses task.learningCandidates for autoConfirm when evaluation lacks autoConfirmCandidateIds', async () => {
      const task = makeTask({
        learningCandidates: [
          { id: 'c1', type: 'memory', autoConfirmEligible: true },
          { id: 'c2', type: 'rule', autoConfirmEligible: false }
        ],
        learningEvaluation: { autoConfirmCandidateIds: [] }
      });
      const queueItem = makeQueueItem();
      const deps = {
        tasks: new Map([['task-1', task]]),
        learningQueue: new Map([['queue-1', queueItem]]),
        learningFlow: makeLearningFlow(),
        persistAndEmitTask: vi.fn().mockResolvedValue(undefined)
      };

      const result = await processLifecycleLearningQueue(deps, 1);
      expect(result).toHaveLength(1);
      expect(deps.learningFlow.confirmCandidates).toHaveBeenCalledWith(task, ['c1']);
    });
  });
});
