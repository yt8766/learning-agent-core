import { describe, expect, it } from 'vitest';

import {
  buildFreshnessAnswerInstruction,
  buildResearchSourcePlan,
  buildTemporalContextBlock,
  isFreshnessSensitiveGoal,
  resolveWorkflowPreset
} from '../src';

describe('shared temporal context and research planning', () => {
  it('keeps freshness helpers stable', () => {
    const referenceDate = new Date('2026-04-15T08:00:00.000Z');

    expect(buildTemporalContextBlock(referenceDate)).toContain('当前绝对时间（ISO）：2026-04-15T08:00:00.000Z');
    expect(isFreshnessSensitiveGoal('今天最新进展是什么')).toBe(true);
    expect(isFreshnessSensitiveGoal('帮我总结架构原则')).toBe(false);
    expect(buildFreshnessAnswerInstruction('最新消息', referenceDate)).toContain('2026-04-15');
    expect(buildFreshnessAnswerInstruction('帮我总结架构原则', referenceDate)).toBe('');
  });

  it('keeps plan-only research planning from preloading open-web sources', () => {
    const resolution = resolveWorkflowPreset('先给一个计划，修复 React + Vite 页面里的状态问题，不要直接执行');

    const plannedSources = buildResearchSourcePlan({
      taskId: 'task-plan-only',
      goal: resolution.normalizedGoal,
      workflow: resolution.preset,
      executionMode: 'plan'
    });

    expect(plannedSources).toEqual([]);
  });

  it('keeps data-report research planning aligned with React and Vite docs', () => {
    const resolution = resolveWorkflowPreset(
      '/data-report 生成一个带趋势图和指标卡的 bonus center 数据报表页面，使用 React 和 Vite'
    );

    const plannedSources = buildResearchSourcePlan({
      taskId: 'task-data-report',
      runId: 'run-data-report',
      goal: resolution.normalizedGoal,
      workflow: resolution.preset,
      executionMode: 'execute'
    });

    expect(plannedSources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceUrl: 'https://react.dev/'
        }),
        expect.objectContaining({
          sourceUrl: 'https://vite.dev/'
        })
      ])
    );
  });
});
