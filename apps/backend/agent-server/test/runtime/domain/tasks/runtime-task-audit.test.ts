import { describe, expect, it } from 'vitest';

import { buildFallbackTaskPlan } from '../../../../src/runtime/domain/tasks/runtime-task-audit';

describe('runtime-task-audit', () => {
  it('uses dispatch selection to derive fallback subtask ownership', () => {
    const plan = buildFallbackTaskPlan({
      id: 'task-1',
      goal: '评估风险',
      createdAt: '2026-04-19T00:00:00.000Z',
      updatedAt: '2026-04-19T00:00:01.000Z',
      status: 'running',
      currentMinistry: 'gongbu-code',
      dispatches: [
        {
          taskId: 'task-1',
          subTaskId: 'sub-review',
          from: 'manager',
          to: 'reviewer',
          kind: 'ministry',
          objective: '先做风险审查',
          specialistDomain: 'risk-compliance',
          selectedAgentId: 'official.reviewer'
        }
      ],
      trace: [],
      approvals: []
    } as any);

    expect(plan.subTasks[0]?.assignedTo).toBe('reviewer');
  });
});
