import { describe, expect, it } from 'vitest';

import { buildResearchSourcePlan, resolveSpecialistRoute, resolveWorkflowPreset, resolveWorkflowRoute } from '../src';

describe('@agent/agents-supervisor workflow routing integration', () => {
  it('keeps data-report execution routing, specialist selection, and research planning aligned', () => {
    const resolution = resolveWorkflowPreset(
      '/data-report 生成一个带趋势图和指标卡的 bonus center 数据报表页面，使用 React 和 Vite'
    );

    expect(resolution.preset.id).toBe('data-report');
    expect(resolution.source).toBe('explicit');

    const route = resolveWorkflowRoute({
      goal: resolution.normalizedGoal,
      workflow: resolution.preset
    });

    expect(route).toEqual(
      expect.objectContaining({
        graph: 'workflow',
        flow: 'supervisor',
        intent: 'workflow-execute',
        executionReadiness: 'ready'
      })
    );

    const specialistRoute = resolveSpecialistRoute({
      goal: resolution.normalizedGoal,
      context: '当前任务要按 bonus center data 模板生成数据报表页面。'
    });

    expect(specialistRoute.specialistLead.domain).toBe('technical-architecture');
    expect(specialistRoute.contextSlicesBySpecialist[0]).toEqual(
      expect.objectContaining({
        specialistId: specialistRoute.specialistLead.id,
        summary: expect.stringContaining('bonus center data'),
        outputInstruction: expect.stringContaining('结构化 JSON')
      })
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

  it('keeps plan-only routing from preloading open-web research sources', () => {
    const resolution = resolveWorkflowPreset('先给一个计划，修复 React + Vite 页面里的状态问题，不要直接执行');

    const route = resolveWorkflowRoute({
      goal: resolution.normalizedGoal,
      workflow: resolution.preset,
      requestedMode: 'plan'
    });

    expect(route).toEqual(
      expect.objectContaining({
        graph: 'workflow',
        flow: 'supervisor',
        intent: 'plan-only'
      })
    );

    const plannedSources = buildResearchSourcePlan({
      taskId: 'task-plan-only',
      goal: resolution.normalizedGoal,
      workflow: resolution.preset,
      executionMode: 'plan'
    });

    expect(plannedSources).toEqual([]);
  });

  it('routes explicit /scaffold requests through the workflow pipeline without inference fallback', () => {
    const resolution = resolveWorkflowPreset(
      '/scaffold preview --host-kind package --name demo-toolkit --template-id package-lib'
    );

    expect(resolution.preset.id).toBe('scaffold');
    expect(resolution.source).toBe('explicit');

    const route = resolveWorkflowRoute({
      goal: resolution.normalizedGoal,
      workflow: resolution.preset
    });

    expect(route).toEqual(
      expect.objectContaining({
        graph: 'workflow',
        flow: 'supervisor',
        intent: 'workflow-execute',
        executionReadiness: 'ready'
      })
    );
  });
});
