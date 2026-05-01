import { describe, expect, it } from 'vitest';

import {
  isPendingPlanInterruptReplay,
  resolveNextPlanTurnCount
} from '../src/flows/supervisor/planning-stage-interrupt-helpers';
import type { SupervisorPlanningTaskLike } from '../src/flows/supervisor/pipeline-stage-node.types';

describe('planning stage interrupt idempotency helpers', () => {
  it('keeps the existing plan turn count when LangGraph replays a pending plan interrupt', () => {
    const task: SupervisorPlanningTaskLike = {
      id: 'task-1',
      goal: 'Confirm plan',
      activeInterrupt: {
        id: 'interrupt_task-1_plan_question',
        status: 'pending',
        kind: 'user-input',
        interactionKind: 'plan-question',
        createdAt: '2026-05-01T00:00:00.000Z'
      },
      approvals: [],
      trace: []
    };

    expect(isPendingPlanInterruptReplay(task, 'interrupt_task-1_plan_question')).toBe(true);
    expect(resolveNextPlanTurnCount(1, true)).toBe(1);
    expect(resolveNextPlanTurnCount(1, false)).toBe(2);
  });
});
