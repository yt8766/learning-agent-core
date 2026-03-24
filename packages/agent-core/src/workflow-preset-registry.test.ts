import { describe, expect, it } from 'vitest';

import { buildWorkflowPresetPlan, resolveWorkflowPreset } from './workflows/workflow-preset-registry';

describe('workflow-preset-registry', () => {
  it('优先解析显式 Skill 命令，并去掉命令前缀', () => {
    const resolution = resolveWorkflowPreset('/qa 帮我回归测试聊天主链路');

    expect(resolution.source).toBe('explicit');
    expect(resolution.command).toBe('/qa');
    expect(resolution.normalizedGoal).toBe('帮我回归测试聊天主链路');
    expect(resolution.preset.id).toBe('qa');
  });

  it('未显式指定时可根据意图自动推断流程模板', () => {
    const resolution = resolveWorkflowPreset('请帮我做一次代码审查并指出安全风险');

    expect(resolution.source).toBe('inferred');
    expect(resolution.preset.id).toBe('review');
  });

  it('可以根据流程模板构造稳定的执行计划骨架', () => {
    const resolution = resolveWorkflowPreset('/ship 帮我整理这次发布前检查');
    const plan = buildWorkflowPresetPlan('task-1', resolution.normalizedGoal, resolution.preset);

    expect(plan.goal).toBe('帮我整理这次发布前检查');
    expect(plan.subTasks).toHaveLength(3);
    expect(plan.summary).toContain('发布流程');
  });
});
