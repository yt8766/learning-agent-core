import { describe, expect, it, vi } from 'vitest';

import {
  handleLifecycleInterruptTimeout,
  applyTimeoutPlanDefaults
} from '../../../../../../src/graphs/main/runtime/lifecycle/approval/main-graph-lifecycle-approval-timeout';

function makeParams(overrides: Record<string, any> = {}) {
  return {
    addTrace: vi.fn(),
    addProgressDelta: vi.fn(),
    transitionQueueState: vi.fn(),
    runTaskPipeline: vi.fn().mockResolvedValue(undefined),
    persistAndEmitTask: vi.fn().mockResolvedValue(undefined),
    ...overrides
  } as any;
}

function makeTask(overrides: Record<string, any> = {}) {
  return {
    id: 'task-1',
    goal: 'test goal',
    trace: [],
    activeInterrupt: {
      id: 'int-1',
      status: 'pending',
      kind: 'approval',
      interactionKind: 'approval',
      createdAt: '2026-04-16T00:00:00.000Z',
      timeoutMinutes: 30,
      reason: 'needs review'
    },
    interruptHistory: [],
    ...overrides
  } as any;
}

describe('handleLifecycleInterruptTimeout', () => {
  it('returns undefined when no active interrupt', async () => {
    const params = makeParams();
    const task = makeTask({ activeInterrupt: undefined });
    const result = await handleLifecycleInterruptTimeout(params, task, '2026-04-16T01:00:00.000Z');
    expect(result).toBeUndefined();
  });

  it('returns undefined when interrupt status is not pending', async () => {
    const params = makeParams();
    const task = makeTask({
      activeInterrupt: { status: 'resolved', kind: 'approval', createdAt: '2026-04-16T00:00:00.000Z' }
    });
    const result = await handleLifecycleInterruptTimeout(params, task, '2026-04-16T01:00:00.000Z');
    expect(result).toBeUndefined();
  });

  it('cancels task on approval timeout', async () => {
    const params = makeParams();
    const task = makeTask();
    const result = await handleLifecycleInterruptTimeout(params, task, '2026-04-16T01:00:00.000Z');

    expect(result).toBeDefined();
    expect(task.activeInterrupt.status).toBe('cancelled');
    expect(task.activeInterrupt.timedOutAt).toBe('2026-04-16T01:00:00.000Z');
    expect(task.status).toBe('cancelled');
    expect(task.pendingApproval).toBeUndefined();
    expect(task.pendingAction).toBeUndefined();
    expect(params.transitionQueueState).toHaveBeenCalledWith(task, 'cancelled');
    expect(params.persistAndEmitTask).toHaveBeenCalled();
  });

  it('cancels task on supplemental-input timeout', async () => {
    const params = makeParams();
    const task = makeTask({
      activeInterrupt: {
        id: 'int-1',
        status: 'pending',
        kind: 'user-input',
        interactionKind: 'supplemental-input',
        createdAt: '2026-04-16T00:00:00.000Z',
        timeoutMinutes: 15
      }
    });
    const result = await handleLifecycleInterruptTimeout(params, task, '2026-04-16T01:00:00.000Z');

    expect(result).toBeDefined();
    expect(task.status).toBe('cancelled');
    expect(task.currentStep).toBe('supplemental_input_timeout');
  });

  it('applies default options on plan-question timeout and resumes pipeline', async () => {
    const params = makeParams();
    const task = makeTask({
      activeInterrupt: {
        id: 'int-1',
        status: 'pending',
        kind: 'user-input',
        interactionKind: 'plan-question',
        createdAt: '2026-04-16T00:00:00.000Z',
        timeoutMinutes: 10
      },
      planDraft: {
        questions: [
          {
            id: 'q1',
            recommendedOptionId: 'opt-1',
            defaultAssumption: 'use default',
            options: [{ id: 'opt-1', description: 'option 1' }],
            impactOnPlan: 'minor'
          }
        ]
      },
      planMode: 'drafting'
    });
    const result = await handleLifecycleInterruptTimeout(params, task, '2026-04-16T01:00:00.000Z');

    expect(result).toBeDefined();
    expect(task.status).toBe('running');
    expect(task.currentStep).toBe('manager_plan');
    expect(task.planMode).toBe('finalized');
    expect(params.runTaskPipeline).toHaveBeenCalled();
  });

  it('detects interactionKind from interrupt.kind when not explicitly set', async () => {
    const params = makeParams();
    const task = makeTask({
      activeInterrupt: {
        id: 'int-1',
        status: 'pending',
        kind: 'user-input',
        createdAt: '2026-04-16T00:00:00.000Z',
        timeoutMinutes: 10,
        payload: {}
      }
    });
    const result = await handleLifecycleInterruptTimeout(params, task, '2026-04-16T01:00:00.000Z');

    expect(result).toBeDefined();
    // user-input without interactionKind defaults to plan-question
    expect(task.planMode).toBe('finalized');
  });

  it('returns undefined for unknown interactionKind', async () => {
    const params = makeParams();
    const task = makeTask({
      activeInterrupt: {
        id: 'int-1',
        status: 'pending',
        kind: 'unknown-kind',
        interactionKind: 'unknown',
        createdAt: '2026-04-16T00:00:00.000Z',
        timeoutMinutes: 10
      }
    });
    const result = await handleLifecycleInterruptTimeout(params, task, '2026-04-16T01:00:00.000Z');
    expect(result).toBeUndefined();
  });

  it('detects interactionKind from payload.interactionKind', async () => {
    const params = makeParams();
    const task = makeTask({
      activeInterrupt: {
        id: 'int-1',
        status: 'pending',
        kind: 'approval',
        createdAt: '2026-04-16T00:00:00.000Z',
        timeoutMinutes: 10,
        payload: { interactionKind: 'approval' }
      }
    });
    const result = await handleLifecycleInterruptTimeout(params, task, '2026-04-16T01:00:00.000Z');
    expect(result).toBeDefined();
    expect(task.status).toBe('cancelled');
  });

  it('updates learningEvaluation timeoutStats', async () => {
    const params = makeParams();
    const task = makeTask({
      activeInterrupt: {
        id: 'int-1',
        status: 'pending',
        kind: 'approval',
        interactionKind: 'approval',
        createdAt: '2026-04-16T00:00:00.000Z',
        timeoutMinutes: 30
      },
      learningEvaluation: {
        score: 50,
        timeoutStats: { count: 2, defaultAppliedCount: 1 }
      }
    });
    await handleLifecycleInterruptTimeout(params, task, '2026-04-16T01:00:00.000Z');
    expect(task.learningEvaluation.timeoutStats.count).toBe(3);
  });

  it('increments defaultAppliedCount for plan-question timeout', async () => {
    const params = makeParams();
    const task = makeTask({
      activeInterrupt: {
        id: 'int-1',
        status: 'pending',
        kind: 'user-input',
        interactionKind: 'plan-question',
        createdAt: '2026-04-16T00:00:00.000Z',
        timeoutMinutes: 10
      },
      planDraft: { questions: [] },
      planMode: 'drafting'
    });
    await handleLifecycleInterruptTimeout(params, task, '2026-04-16T01:00:00.000Z');
    expect(task.learningEvaluation.timeoutStats.defaultAppliedCount).toBe(1);
  });
});

describe('applyTimeoutPlanDefaults', () => {
  it('finalizes planMode and sets executionPlan mode to execute', () => {
    const task = {
      planDraft: { questions: [], assumptions: [] },
      planMode: 'drafting',
      executionPlan: { mode: 'plan' },
      planModeTransitions: []
    } as any;

    applyTimeoutPlanDefaults(task, '2026-04-16T01:00:00.000Z');

    expect(task.planMode).toBe('finalized');
    expect(task.executionPlan.mode).toBe('execute');
    expect(task.executionMode).toBe('execute');
    expect(task.planModeTransitions).toHaveLength(1);
    expect(task.planModeTransitions[0].reason).toBe('timeout_default_continue');
  });

  it('creates decisions from questions with recommended options', () => {
    const task = {
      planDraft: {
        questions: [
          {
            id: 'q1',
            recommendedOptionId: 'opt-1',
            defaultAssumption: 'default value',
            options: [{ id: 'opt-1', description: 'Best option' }],
            impactOnPlan: 'high',
            whyAsked: 'Need to decide'
          }
        ],
        assumptions: []
      },
      planMode: 'drafting',
      executionPlan: undefined,
      planModeTransitions: undefined
    } as any;

    applyTimeoutPlanDefaults(task, '2026-04-16T01:00:00.000Z');

    expect(task.planDraft.decisions).toHaveLength(1);
    expect(task.planDraft.decisions[0].questionId).toBe('q1');
    expect(task.planDraft.decisions[0].resolutionSource).toBe('default-assumption');
    expect(task.planDraft.decisions[0].selectedOptionId).toBe('opt-1');
    expect(task.planDraft.decisions[0].decisionRationale).toBe('Best option');
    expect(task.planDraft.assumptions).toContain('default value');
    expect(task.planDraft.assumptions).toContain('部分计划问题因超时采用了默认值。');
  });

  it('handles task without planDraft', () => {
    const task = {
      planDraft: undefined,
      planMode: 'drafting',
      planModeTransitions: []
    } as any;

    applyTimeoutPlanDefaults(task, '2026-04-16T01:00:00.000Z');
    expect(task.planMode).toBe('finalized');
  });

  it('uses defaultAssumption when option not found', () => {
    const task = {
      planDraft: {
        questions: [
          {
            id: 'q1',
            recommendedOptionId: 'nonexistent',
            defaultAssumption: 'fallback value',
            options: [],
            impactOnPlan: 'low'
          }
        ],
        assumptions: []
      },
      planMode: 'drafting',
      planModeTransitions: []
    } as any;

    applyTimeoutPlanDefaults(task, '2026-04-16T01:00:00.000Z');
    expect(task.planDraft.decisions[0].decisionRationale).toBe('fallback value');
  });
});
