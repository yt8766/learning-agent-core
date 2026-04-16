import { describe, expect, it } from 'vitest';

import { buildWorkflowPresetPlan, resolveWorkflowPreset } from '../src/workflows/workflow-preset-registry';

describe('workflow preset registry', () => {
  it('对显式命令保留 preset 并裁剪 command 前缀', () => {
    const resolution = resolveWorkflowPreset('/review 检查这个改动有没有安全问题');

    expect(resolution.preset.id).toBe('review');
    expect(resolution.source).toBe('explicit');
    expect(resolution.normalizedGoal).toBe('检查这个改动有没有安全问题');
  });

  it('为 data-report preset 生成专项执行计划', () => {
    const resolution = resolveWorkflowPreset('/data-report 生成 bonus center 数据报表');
    const plan = buildWorkflowPresetPlan('task-1', resolution.normalizedGoal, resolution.preset);

    expect(plan.summary).toContain('数据报表模板');
    expect(plan.subTasks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: '提炼报表模板'
        }),
        expect.objectContaining({
          title: '生成报表模块'
        }),
        expect.objectContaining({
          title: '校验交付结构'
        })
      ])
    );
  });

  it('为 /scaffold 显式命令保留 scaffold preset 且不吞掉子命令参数', () => {
    const resolution = resolveWorkflowPreset(
      '/scaffold preview --host-kind package --name demo-toolkit --template-id package-lib'
    );

    expect(resolution.preset.id).toBe('scaffold');
    expect(resolution.source).toBe('explicit');
    expect(resolution.normalizedGoal).toBe('preview --host-kind package --name demo-toolkit --template-id package-lib');
  });
});
