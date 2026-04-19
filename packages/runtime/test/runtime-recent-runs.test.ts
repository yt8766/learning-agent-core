import { describe, expect, it } from 'vitest';

import { filterAndSortRecentRuntimeRuns } from '../src/runtime/runtime-recent-runs';

describe('runtime recent runs', () => {
  it('filters tasks by status, execution mode, and interaction kind before sorting by updated time', () => {
    const tasks = [
      {
        id: 'task-1',
        status: 'running',
        executionMode: 'plan',
        activeInterrupt: {
          kind: 'user-input',
          payload: { interactionKind: 'plan-question' }
        },
        updatedAt: '2026-04-19T10:00:00.000Z'
      },
      {
        id: 'task-2',
        status: 'running',
        executionPlan: { mode: 'execute' },
        activeInterrupt: {
          kind: 'approval',
          payload: { interactionKind: 'approval' }
        },
        updatedAt: '2026-04-19T12:00:00.000Z'
      },
      {
        id: 'task-3',
        status: 'completed',
        executionMode: 'plan',
        activeInterrupt: {
          kind: 'user-input',
          payload: { interactionKind: 'plan-question' }
        },
        updatedAt: '2026-04-19T11:00:00.000Z'
      }
    ] as any;

    expect(
      filterAndSortRecentRuntimeRuns(tasks, {
        status: 'running',
        executionMode: 'plan',
        interactionKind: 'plan-question'
      })
    ).toEqual([expect.objectContaining({ id: 'task-1' })]);

    expect(filterAndSortRecentRuntimeRuns(tasks, { status: 'running' }).map(task => task.id)).toEqual([
      'task-2',
      'task-1'
    ]);
  });

  it('caps the projection at ten items', () => {
    const tasks = Array.from({ length: 12 }, (_, index) => ({
      id: `task-${index}`,
      status: 'running',
      executionMode: 'execute',
      updatedAt: `2026-04-${String(index + 1).padStart(2, '0')}T00:00:00.000Z`
    })) as any;

    expect(filterAndSortRecentRuntimeRuns(tasks)).toHaveLength(10);
  });
});
