import { describe, expect, it } from 'vitest';

import { applyRoutingProfile, classifyIntent, deriveRoutingProfile } from '../src/workflows/workflow-route-signals';
import { evaluateExecutionReadiness } from '../src/workflows/workflow-route-readiness';

type RoutingSignalContext = Parameters<typeof deriveRoutingProfile>[0];
type ExecutionReadinessTask = Parameters<typeof evaluateExecutionReadiness>[0];

describe('workflow route signals and readiness', () => {
  it('在低置信 workspace 场景下按 profile 收敛为 plan-only', () => {
    const context = {
      goal: '看看这个仓库里页面状态为什么不对',
      context: '先别执行，先分析一下',
      recentTurns: [{ content: '先给我计划，不要直接执行' }, { content: '/plan 先分析' }],
      relatedHistory: ['先分析再动手', '不要执行', '先给计划']
    } as unknown as RoutingSignalContext;

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
      } as unknown as ExecutionReadinessTask,
      'workflow-execute'
    );

    expect(readiness).toEqual(
      expect.objectContaining({
        readiness: 'missing-connector'
      })
    );
  });
});
