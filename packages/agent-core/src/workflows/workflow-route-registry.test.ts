import { describe, expect, it } from 'vitest';

import { resolveWorkflowRoute } from './workflow-route-registry';

describe('resolveWorkflowRoute', () => {
  it('routes general prompts to direct reply so chat can stream immediately', () => {
    const result = resolveWorkflowRoute({
      goal: '解释一下这个项目能做什么'
    });

    expect(result).toEqual({
      graph: 'workflow',
      flow: 'direct-reply',
      reason: 'general_prompt',
      adapter: 'general-prompt',
      priority: 50
    });
  });

  it('routes modification intents to supervisor workflow', () => {
    const result = resolveWorkflowRoute({
      goal: '帮我重构这个仓库的技能路由'
    });

    expect(result).toEqual({
      graph: 'workflow',
      flow: 'supervisor',
      reason: 'modification_intent',
      adapter: 'modification-intent',
      priority: 70
    });
  });

  it('routes freshness-sensitive prompts to supervisor workflow', () => {
    const result = resolveWorkflowRoute({
      goal: '最近 AI 有什么新技术'
    });

    expect(result).toEqual({
      graph: 'workflow',
      flow: 'supervisor',
      reason: 'freshness_sensitive_prompt',
      adapter: 'general-prompt',
      priority: 65
    });
  });

  it('routes approval-only workflows to the approval recovery graph', () => {
    const result = resolveWorkflowRoute({
      goal: '继续执行被挂起的高风险动作',
      workflow: {
        id: 'approval-recovery',
        displayName: 'Approval Recovery',
        intentPatterns: [],
        requiredMinistries: [],
        allowedCapabilities: [],
        approvalPolicy: 'all-actions',
        outputContract: {
          type: 'final_answer',
          requiredSections: []
        }
      }
    });

    expect(result).toEqual({
      graph: 'approval-recovery',
      flow: 'approval',
      reason: 'approval_only_workflow',
      adapter: 'approval-recovery',
      priority: 95
    });
  });
});
