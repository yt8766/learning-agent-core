import { describe, expect, it } from 'vitest';

import { applyTimeoutPlanDefaults } from '../src/graphs/main/runtime/lifecycle/approval/main-graph-lifecycle-approval-timeout';

describe('main graph lifecycle approval helpers', () => {
  it('applies recommended plan defaults and records timeout continuation metadata', () => {
    const task = {
      planMode: 'intent',
      executionPlan: {
        mode: 'plan'
      },
      planDraft: {
        assumptions: ['已有假设'],
        questions: [
          {
            id: 'question-1',
            recommendedOptionId: 'safe-option',
            defaultAssumption: '默认按安全路径继续',
            whyAsked: '需要决定是否直接执行',
            impactOnPlan: '会影响后续执行模式',
            options: [
              {
                id: 'safe-option',
                description: '先保守推进'
              },
              {
                id: 'fast-option',
                description: '直接进入执行'
              }
            ]
          }
        ]
      }
    } as never;

    applyTimeoutPlanDefaults(task, '2026-04-16T08:00:00.000Z');

    expect(task.planMode).toBe('finalized');
    expect(task.executionPlan.mode).toBe('execute');
    expect(task.executionMode).toBe('execute');
    expect(task.planDraft.decisions).toEqual([
      expect.objectContaining({
        questionId: 'question-1',
        resolutionSource: 'default-assumption',
        selectedOptionId: 'safe-option',
        assumedValue: '默认按安全路径继续',
        decisionRationale: '先保守推进'
      })
    ]);
    expect(task.planDraft.assumptions).toContain('默认按安全路径继续');
    expect(task.planDraft.assumptions).toContain('部分计划问题因超时采用了默认值。');
    expect(task.planModeTransitions).toEqual([
      expect.objectContaining({
        from: 'intent',
        to: 'finalized',
        reason: 'timeout_default_continue'
      })
    ]);
  });
});
