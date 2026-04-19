import { describe, expect, it } from 'vitest';

import {
  filterAndSortRunObservatoryRuns,
  filterAndSortRunObservatoryTasks,
  parseRunObservatoryLimit
} from '../../src/runtime-observability/runtime-run-observatory';

describe('runtime run observatory', () => {
  it('parses run observatory limit defensively', () => {
    expect(parseRunObservatoryLimit(undefined)).toBeUndefined();
    expect(parseRunObservatoryLimit('')).toBeUndefined();
    expect(parseRunObservatoryLimit('4')).toBe(4);
    expect(parseRunObservatoryLimit(3.9)).toBe(3);
    expect(parseRunObservatoryLimit('0')).toBe(1);
  });

  it('filters and sorts tasks for observatory projection before run bundle mapping', () => {
    const result = filterAndSortRunObservatoryTasks(
      [
        {
          id: 'task-1',
          goal: 'Diagnose regression',
          status: 'running',
          sessionId: 'session-1',
          executionPlan: { mode: 'plan' },
          activeInterrupt: {
            id: 'interrupt-1',
            kind: 'approval',
            status: 'pending',
            payload: { interactionKind: 'approval' }
          },
          llmUsage: {
            models: [{ model: 'gpt-5.4-mini', pricingSource: 'estimated' }]
          },
          createdAt: '2026-04-19T09:59:00.000Z',
          updatedAt: '2026-04-19T10:03:00.000Z'
        },
        {
          id: 'task-2',
          goal: 'Draft plan',
          status: 'completed',
          sessionId: 'session-2',
          executionPlan: { mode: 'execute' },
          createdAt: '2026-04-19T08:59:00.000Z',
          updatedAt: '2026-04-19T09:03:00.000Z'
        }
      ] as any,
      {
        status: 'running',
        model: 'gpt-5.4-mini',
        pricingSource: 'estimated',
        executionMode: 'plan',
        interactionKind: 'approval',
        q: 'regression'
      }
    );

    expect(result).toEqual([expect.objectContaining({ id: 'task-1' })]);
  });

  it('filters and sorts mapped run summaries before response projection', () => {
    const result = filterAndSortRunObservatoryRuns(
      [
        {
          taskId: 'task-older',
          startedAt: '2026-04-19T09:59:00.000Z',
          hasInterrupt: true,
          hasFallback: false,
          hasRecoverableCheckpoint: true
        },
        {
          taskId: 'task-newer',
          startedAt: '2026-04-19T10:03:00.000Z',
          hasInterrupt: true,
          hasFallback: true,
          hasRecoverableCheckpoint: true
        }
      ],
      {
        hasInterrupt: 'true',
        hasFallback: 'true',
        hasRecoverableCheckpoint: 'true'
      },
      5
    );

    expect(result).toEqual([expect.objectContaining({ taskId: 'task-newer' })]);
  });
});
