import { describe, expect, it } from 'vitest';

import {
  applyRoutingProfile,
  classifyIntent,
  deriveRoutingProfile,
  evaluateExecutionReadiness,
  resolveWorkflowPreset,
  resolveWorkflowRoute
} from '../src';

describe('shared workflow route contracts', () => {
  it('在低置信 workspace 场景下按 profile 收敛为 plan-only', () => {
    const context = {
      goal: '看看这个仓库里页面状态为什么不对',
      context: '先别执行，先分析一下',
      recentTurns: [{ content: '先给我计划，不要直接执行' }, { content: '/plan 先分析' }],
      relatedHistory: ['先分析再动手', '不要执行', '先给计划']
    } as const;

    const profile = deriveRoutingProfile(context);
    const adjusted = applyRoutingProfile(classifyIntent(context), profile, context);

    expect(profile.defaultMode).toBe('plan-first');
    expect(adjusted.intent).toBe('plan-only');
    expect(adjusted.reasonHint).toBe('profile_plan_first');
  });

  it('在缺少 connector 时把 workflow-execute 判定为 missing-connector', () => {
    const readiness = evaluateExecutionReadiness(
      {
        goal: '同步到飞书',
        requestedHints: {
          requestedConnectorTemplate: 'lark-mcp-template'
        },
        connectorRefs: [],
        capabilityAttachments: []
      },
      'workflow-execute'
    );

    expect(readiness).toEqual(
      expect.objectContaining({
        readiness: 'missing-connector'
      })
    );
  });

  it('保持 data-report preset 的 workflow 路由稳定', () => {
    const resolution = resolveWorkflowPreset(
      '/data-report 生成一个带趋势图和指标卡的 bonus center 数据报表页面，使用 React 和 Vite'
    );

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

  it('仅在显式 /scaffold 命令下进入 scaffold workflow', () => {
    const implicit = resolveWorkflowPreset('帮我做一个新的 package scaffold');
    const explicit = resolveWorkflowPreset('/scaffold list-templates');

    expect(implicit.preset.id).toBe('general');
    expect(explicit.preset.id).toBe('scaffold');
    expect(explicit.source).toBe('explicit');
  });
});
