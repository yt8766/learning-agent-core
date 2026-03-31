import { describe, expect, it, vi } from 'vitest';

import { ActionIntent, TaskStatus } from '@agent/shared';

import { createOrchestrator } from './orchestrator.test.utils';

// task.entryDecision remains the persisted 通政司 / EntryRouter projection in orchestrator fixtures.
describe('AgentOrchestrator core flows', () => {
  it('按更新时间倒序返回任务，并筛出待审批任务', async () => {
    const orchestrator = createOrchestrator({
      tasks: [
        {
          id: 'task-old',
          goal: 'older',
          status: TaskStatus.COMPLETED,
          trace: [],
          approvals: [],
          agentStates: [],
          messages: [],
          createdAt: '2026-03-22T00:00:00.000Z',
          updatedAt: '2026-03-22T00:00:00.000Z'
        },
        {
          id: 'task-pending',
          goal: 'pending',
          status: TaskStatus.WAITING_APPROVAL,
          trace: [],
          approvals: [
            {
              taskId: 'task-pending',
              intent: ActionIntent.WRITE_FILE,
              decision: 'pending',
              decidedAt: '2026-03-22T00:00:00.000Z'
            }
          ],
          agentStates: [],
          messages: [],
          createdAt: '2026-03-22T00:01:00.000Z',
          updatedAt: '2026-03-22T00:01:00.000Z'
        }
      ],
      learningJobs: [],
      pendingExecutions: [],
      chatSessions: [],
      chatMessages: [],
      chatEvents: [],
      chatCheckpoints: []
    });

    await orchestrator.initialize();

    expect(orchestrator.listTasks().map((task: any) => task.id)).toEqual(['task-pending', 'task-old']);
    expect(orchestrator.listPendingApprovals().map((task: any) => task.id)).toEqual(['task-pending']);
  });

  it('重试任务时会重置状态并重新进入 pipeline', async () => {
    const orchestrator = createOrchestrator({
      tasks: [
        {
          id: 'task-1',
          goal: 'retry me',
          status: TaskStatus.FAILED,
          trace: [],
          approvals: [],
          agentStates: [],
          messages: [],
          review: {
            taskId: 'task-1',
            decision: 'retry',
            notes: ['retry please'],
            createdAt: '2026-03-22T00:00:00.000Z'
          },
          result: 'old result',
          currentStep: 'review',
          retryCount: 1,
          maxRetries: 1,
          createdAt: '2026-03-22T00:00:00.000Z',
          updatedAt: '2026-03-22T00:00:00.000Z'
        }
      ],
      learningJobs: [],
      pendingExecutions: [
        {
          taskId: 'task-1',
          intent: ActionIntent.WRITE_FILE,
          toolName: 'write_local_file',
          researchSummary: 'summary'
        }
      ],
      chatSessions: [],
      chatMessages: [],
      chatEvents: [],
      chatCheckpoints: []
    });

    orchestrator.runTaskPipeline = vi.fn(async () => undefined);
    await orchestrator.initialize();

    const retried = await orchestrator.retryTask('task-1');

    expect(retried).toEqual(
      expect.objectContaining({
        id: 'task-1',
        status: TaskStatus.QUEUED,
        currentStep: 'queued',
        retryCount: 0,
        maxRetries: 1,
        review: undefined,
        result: undefined
      })
    );
    expect(orchestrator.pendingExecutions.has('task-1')).toBe(false);
    expect(orchestrator.runTaskPipeline).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'task-1' }),
      { goal: 'retry me', constraints: [] },
      { mode: 'retry' }
    );
  });

  it('遇到“你是谁”这类问题时走 direct reply 快路径并产出最终回复', async () => {
    const orchestrator = createOrchestrator();
    await orchestrator.initialize();

    const task = await orchestrator.createTask({
      goal: '你是谁',
      constraints: [],
      sessionId: 'session-direct-reply'
    });

    expect(task.status).toBe(TaskStatus.COMPLETED);
    expect(task.currentStep).toBe('direct_reply');
    expect(task.result).toContain('多 Agent');
    expect(task.messages).toEqual(expect.arrayContaining([expect.objectContaining({ type: 'summary' })]));
  });

  it('普通对话消息默认走 direct reply 快路径，便于前端流式返回', async () => {
    const orchestrator = createOrchestrator();
    await orchestrator.initialize();

    const task = await orchestrator.createTask({
      goal: '解释一下这个系统能做什么',
      constraints: [],
      sessionId: 'session-general-chat'
    });

    expect(task.status).toBe(TaskStatus.COMPLETED);
    expect(task.trace).toEqual(expect.arrayContaining([expect.objectContaining({ node: 'direct_reply' })]));
    expect(task.trace).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          node: 'route',
          summary: expect.stringContaining('direct-reply')
        })
      ])
    );
  });

  it('修改类请求继续走完整多 Agent 工作流', async () => {
    const orchestrator = createOrchestrator();
    await orchestrator.initialize();

    const task = await orchestrator.createTask({
      goal: '帮我重构这个仓库的技能路由',
      constraints: [],
      sessionId: 'session-modification'
    });

    expect(task.currentStep).not.toBe('direct_reply');
    expect(task.trace).toEqual(expect.arrayContaining([expect.objectContaining({ node: 'dispatch_planner' })]));
    expect(task.trace).toEqual(expect.arrayContaining([expect.objectContaining({ node: 'context_filter' })]));
  });

  it('by_session_ratio 会按显式 weights 稳定选择群辅版本', async () => {
    const orchestrator = createOrchestrator();
    await orchestrator.initialize();

    const task = await orchestrator.createTask({
      goal: '帮我重构这个仓库的技能路由',
      constraints: [],
      sessionId: 'session-weighted-selector',
      counselorSelector: {
        strategy: 'session-ratio',
        candidateIds: ['payment-counselor-v1', 'payment-counselor-v2'],
        weights: [0, 5],
        fallbackCounselorId: 'payment-counselor-v1'
      }
    });

    expect(task.entryDecision?.counselorSelector?.selectedCounselorId).toBe('payment-counselor-v2');
    expect(task.executionPlan?.selectedCounselorId).toBe('payment-counselor-v2');
    expect(task.entryDecision?.selectionReason).toBe('by_session_ratio');
  });

  it('会把长期治理画像反向接入 execution plan 与 context filter', async () => {
    const orchestrator = createOrchestrator({
      tasks: [],
      learningJobs: [],
      pendingExecutions: [],
      chatSessions: [],
      chatMessages: [],
      chatEvents: [],
      chatCheckpoints: [],
      governance: {
        counselorSelectorConfigs: [],
        capabilityGovernanceProfiles: [],
        ministryGovernanceProfiles: [
          {
            entityId: 'gongbu-code',
            displayName: 'gongbu-code',
            entityKind: 'ministry',
            trustLevel: 'low',
            trustTrend: 'down',
            reportCount: 4,
            promoteCount: 0,
            holdCount: 1,
            downgradeCount: 3,
            passCount: 1,
            reviseRequiredCount: 2,
            blockCount: 1,
            lastTaskId: 'task-9',
            lastReviewDecision: 'block',
            lastTrustAdjustment: 'downgrade',
            lastReason: '近期代码执行风险偏高。',
            lastGovernanceSummary: '收紧临时能力注入。',
            updatedAt: '2026-03-31T00:00:00.000Z'
          }
        ],
        workerGovernanceProfiles: [],
        specialistGovernanceProfiles: [
          {
            entityId: 'technical-architecture',
            displayName: '技术架构专家',
            entityKind: 'specialist',
            trustLevel: 'low',
            trustTrend: 'down',
            reportCount: 3,
            promoteCount: 0,
            holdCount: 1,
            downgradeCount: 2,
            passCount: 1,
            reviseRequiredCount: 1,
            blockCount: 1,
            lastTaskId: 'task-8',
            lastReviewDecision: 'revise_required',
            lastTrustAdjustment: 'downgrade',
            lastReason: '近期方案需要更多交叉校验。',
            lastGovernanceSummary: '先走保守派发。',
            updatedAt: '2026-03-31T00:00:00.000Z'
          }
        ]
      }
    });
    await orchestrator.initialize();

    const task = await orchestrator.createTask({
      goal: '帮我重构这个仓库的运行时架构和代码组织',
      constraints: [],
      sessionId: 'session-governance-backfeed'
    });

    expect(task.executionPlan?.filteredCapabilities).not.toContain('temporary-assignment');
    expect(task.executionPlan?.modeCapabilities).toEqual(
      expect.arrayContaining(['governance-escalated-review', 'trust-gated-capability-pool'])
    );
    expect(task.contextFilterState?.dispatchOrder).toEqual(['strategy', 'fallback', 'ministry']);
    expect(task.contextFilterState?.noiseGuards).toEqual(
      expect.arrayContaining(['prioritize_governance_feedback', 'require_cross_check_before_write'])
    );
    expect(task.routeConfidence).toBeLessThan(0.9);
  });

  it('审批打回附带反馈时会写入反馈上下文', async () => {
    const orchestrator = createOrchestrator({
      tasks: [
        {
          id: 'task-1',
          runId: 'run-1',
          goal: '发布这个功能',
          status: TaskStatus.WAITING_APPROVAL,
          currentNode: 'approval_gate',
          trace: [],
          approvals: [],
          agentStates: [],
          messages: [],
          createdAt: '2026-03-22T00:00:00.000Z',
          updatedAt: '2026-03-22T00:00:00.000Z'
        }
      ],
      learningJobs: [],
      pendingExecutions: [],
      chatSessions: [],
      chatMessages: [],
      chatEvents: [],
      chatCheckpoints: []
    });

    await orchestrator.initialize();

    const task = await orchestrator.applyApproval(
      'task-1',
      {
        intent: ActionIntent.WRITE_FILE,
        actor: 'emperor',
        feedback: '重写，这里的发布说明还不够完整'
      },
      'rejected' as never
    );

    expect(task).toEqual(
      expect.objectContaining({
        approvalFeedback: '重写，这里的发布说明还不够完整',
        status: TaskStatus.BLOCKED
      })
    );
    expect(task?.trace).toEqual(
      expect.arrayContaining([expect.objectContaining({ node: 'approval_rejected_with_feedback' })])
    );
  });

  it('step budget 超限时会进入预算阻断态', async () => {
    const orchestrator = createOrchestrator();
    await orchestrator.initialize();

    const task = {
      id: 'task-budget',
      goal: '预算治理测试',
      status: TaskStatus.QUEUED,
      trace: [],
      approvals: [],
      agentStates: [],
      messages: [],
      createdAt: '2026-03-24T00:00:00.000Z',
      updatedAt: '2026-03-24T00:00:00.000Z',
      budgetState: {
        stepBudget: 1,
        stepsConsumed: 0,
        retryBudget: 1,
        retriesConsumed: 0,
        sourceBudget: 2,
        sourcesConsumed: 0
      }
    } as any;

    expect(() =>
      orchestrator.syncTaskRuntime(task, {
        currentStep: 'review',
        retryCount: 0,
        maxRetries: 1
      })
    ).toThrow('step budget');
  });
});
