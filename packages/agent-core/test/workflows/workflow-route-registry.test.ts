import { describe, expect, it } from 'vitest';

import { resolveWorkflowRoute } from '../../src/workflows/workflow-route-registry';

describe('resolveWorkflowRoute', () => {
  it('routes general prompts to direct reply so chat can stream immediately', () => {
    const result = resolveWorkflowRoute({
      goal: '解释一下这个项目能做什么'
    });

    expect(result).toEqual(
      expect.objectContaining({
        graph: 'workflow',
        flow: 'direct-reply',
        reason: 'general_prompt',
        adapter: 'general-prompt',
        priority: 50,
        intent: 'direct-reply',
        executionReadiness: 'ready'
      })
    );
  });

  it('routes conversation recall prompts to direct reply with recall reason', () => {
    const result = resolveWorkflowRoute({
      goal: '我们刚刚聊了什么？'
    });

    expect(result).toEqual(
      expect.objectContaining({
        graph: 'workflow',
        flow: 'direct-reply',
        reason: 'conversation_recall_prompt',
        adapter: 'general-prompt',
        priority: 50,
        intent: 'direct-reply'
      })
    );
  });

  it('routes modification intents to supervisor workflow', () => {
    const result = resolveWorkflowRoute({
      goal: '帮我重构这个仓库的技能路由'
    });

    expect(result).toEqual(
      expect.objectContaining({
        graph: 'workflow',
        flow: 'supervisor',
        reason: 'modification_intent',
        adapter: 'modification-intent',
        priority: 70,
        intent: 'workflow-execute',
        executionReadiness: 'ready'
      })
    );
  });

  it('routes freshness-sensitive prompts to research-first workflow', () => {
    const result = resolveWorkflowRoute({
      goal: '最近 AI 有什么新技术'
    });

    expect(result).toEqual(
      expect.objectContaining({
        graph: 'workflow',
        flow: 'supervisor',
        reason: 'freshness_sensitive_prompt',
        adapter: 'research-first',
        priority: 66,
        intent: 'research-first'
      })
    );
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

    expect(result).toEqual(
      expect.objectContaining({
        graph: 'approval-recovery',
        flow: 'approval',
        reason: 'approval_only_workflow',
        adapter: 'approval-recovery',
        priority: 95,
        intent: 'approval-recovery'
      })
    );
  });

  it('routes explicit plan-only requests to supervisor without entering execution intent', () => {
    const result = resolveWorkflowRoute({
      goal: '先给我一个计划，不要执行',
      requestedMode: 'plan'
    });

    expect(result).toEqual(
      expect.objectContaining({
        graph: 'workflow',
        flow: 'supervisor',
        adapter: 'plan-only',
        intent: 'plan-only',
        executionReadiness: 'ready'
      })
    );
  });

  it('falls back to direct reply when requested connector is missing', () => {
    const result = resolveWorkflowRoute({
      goal: '帮我用 github connector 改一下这个 PR',
      requestedHints: {
        requestedConnectorTemplate: 'github-mcp-template',
        preferredMode: 'workflow'
      }
    });

    expect(result).toEqual(
      expect.objectContaining({
        flow: 'direct-reply',
        adapter: 'readiness-fallback',
        intent: 'workflow-execute',
        executionReadiness: 'missing-connector'
      })
    );
  });
});
