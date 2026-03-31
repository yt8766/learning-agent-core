import { describe, expect, it } from 'vitest';

import { filterRuntimeInterruptItems } from '@/features/runtime-overview/components/runtime-summary-tools';

describe('RuntimeSummaryTools helpers', () => {
  it('filters interrupt items by execution mode and interaction kind', () => {
    const filtered = filterRuntimeInterruptItems(
      [
        {
          taskId: 'task-plan',
          goal: '先给方案',
          status: 'waiting_interrupt',
          executionMode: 'plan',
          interactionKind: 'plan-question',
          interruptLabel: '计划问题',
          updatedAt: '2026-03-29T10:00:00.000Z'
        },
        {
          taskId: 'task-approval',
          goal: '发布配置',
          status: 'waiting_approval',
          executionMode: 'execute',
          interactionKind: 'approval',
          interruptLabel: 'enable_connector',
          updatedAt: '2026-03-29T09:00:00.000Z'
        }
      ],
      { executionMode: 'plan', interactionKind: 'plan-question' }
    );

    expect(filtered).toEqual([
      expect.objectContaining({
        taskId: 'task-plan',
        executionMode: 'plan',
        interactionKind: 'plan-question'
      })
    ]);
  });
});
