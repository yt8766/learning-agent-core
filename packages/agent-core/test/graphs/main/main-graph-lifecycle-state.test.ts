import { describe, expect, it } from 'vitest';

import { enqueueTaskLearningItem } from '../../../src/graphs/main/lifecycle/main-graph-lifecycle-state';

describe('enqueueTaskLearningItem', () => {
  it('marks task learning as queued for background materialization', () => {
    const queue = new Map();
    const task: any = {
      id: 'task_1',
      runId: 'run_1',
      trace: [],
      result: 'done',
      updatedAt: '2026-04-01T00:00:00.000Z'
    };

    const item = enqueueTaskLearningItem(queue, task);

    expect(item.mode).toBe('task-learning');
    expect(task.backgroundLearningState).toEqual(
      expect.objectContaining({
        status: 'queued',
        mode: 'task-learning'
      })
    );
  });
});
