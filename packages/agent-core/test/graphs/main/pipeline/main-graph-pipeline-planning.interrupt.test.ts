import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@langchain/langgraph', async () => {
  const actual = await vi.importActual<typeof import('@langchain/langgraph')>('@langchain/langgraph');
  return {
    ...actual,
    interrupt: vi.fn()
  };
});

import { interrupt } from '@langchain/langgraph';
import { AgentRole, TaskStatus, type TaskRecord } from '@agent/shared';

import { runManagerPlanStage } from '../../../../src/flows/supervisor/pipeline-stage-nodes';

// task.activeInterrupt remains the persisted 司礼监 / InterruptController projection in planning-interrupt tests.
function createPlanningTask(goal: string): TaskRecord {
  const now = new Date().toISOString();
  return {
    id: 'task-plan-1',
    goal,
    status: TaskStatus.QUEUED,
    trace: [],
    approvals: [],
    agentStates: [],
    messages: [],
    resolvedWorkflow: {
      id: 'plan-eng-review',
      displayName: '工程方案评审',
      requiredMinistries: ['libu-router', 'gongbu-code', 'libu-docs'],
      allowedCapabilities: [],
      approvalPolicy: 'high-risk-only',
      intentPatterns: [],
      outputContract: { type: 'engineering_review', requiredSections: ['architecture'] }
    },
    createdAt: now,
    updatedAt: now
  } as any as TaskRecord;
}

function createCallbacks(now: string) {
  return {
    ensureTaskNotCancelled: vi.fn(),
    syncTaskRuntime: vi.fn(),
    addTrace: vi.fn((currentTask: TaskRecord, node: string, summary: string, data?: Record<string, unknown>) => {
      currentTask.trace.push({ node, at: now, summary, data } as never);
    }),
    addProgressDelta: vi.fn(),
    attachTool: vi.fn(),
    recordToolUsage: vi.fn(),
    persistAndEmitTask: vi.fn(async () => undefined),
    resolveWorkflowRoutes: vi.fn(() => []),
    markWorkerUsage: vi.fn(),
    recordDispatches: vi.fn(),
    upsertAgentState: vi.fn()
  };
}

describe('main-graph-pipeline-planning interrupts', () => {
  beforeEach(() => {
    vi.mocked(interrupt).mockReset();
  });

  it('supports bypassing plan questions and continuing into execution', async () => {
    const now = new Date().toISOString();
    vi.mocked(interrupt).mockReturnValue({ action: 'bypass' } as never);
    const task = createPlanningTask('/plan-eng-review 为 agent-chat 增加计划模式');
    const callbacks = createCallbacks(now);
    const libu = {
      plan: vi.fn(),
      getState: vi.fn(() => ({ role: AgentRole.MANAGER, status: 'running' })),
      dispatch: vi.fn(() => [])
    };

    const next = await runManagerPlanStage(
      task,
      { goal: task.goal, sessionId: 'session:test' },
      { retryCount: 0, maxRetries: 2, dispatches: [] } as any,
      libu as any,
      callbacks as any
    );

    expect(task.planMode).toBe('finalized');
    expect(task.executionPlan?.mode).toBe('execute');
    expect(task.activeInterrupt?.status).toBe('resolved');
    expect(task.planDraft?.decisions?.every(item => item.resolutionSource === 'bypass-recommended')).toBe(true);
    expect((next as any).terminateAfterPlanning).not.toBe(true);
  });

  it('supports aborting a planning interrupt and cancels the task', async () => {
    const now = new Date().toISOString();
    vi.mocked(interrupt).mockReturnValue({ action: 'abort' } as never);
    const task = createPlanningTask('/plan-eng-review 为 agent-chat 增加计划模式');
    const callbacks = createCallbacks(now);
    const libu = {
      plan: vi.fn(),
      getState: vi.fn(() => ({ role: AgentRole.MANAGER, status: 'running' })),
      dispatch: vi.fn(() => [])
    };

    const next = await runManagerPlanStage(
      task,
      { goal: task.goal, sessionId: 'session:test' },
      { retryCount: 0, maxRetries: 2, dispatches: [] } as any,
      libu as any,
      callbacks as any
    );

    expect(task.status).toBe(TaskStatus.CANCELLED);
    expect(task.planMode).toBe('aborted');
    expect(task.result).toBe('计划已取消。');
    expect((next as any).terminateAfterPlanning).toBe(true);
  });

  it('falls back to default assumptions for ambiguous plan answers', async () => {
    const now = new Date().toISOString();
    vi.mocked(interrupt).mockReturnValue({
      action: 'input',
      payload: {
        answers: [
          {
            questionId: 'delivery_mode',
            freeform: '你看着办就行'
          }
        ]
      }
    } as never);
    const task = createPlanningTask('/plan-eng-review 为 agent-chat 增加计划模式');
    const callbacks = createCallbacks(now);
    const libu = {
      plan: vi.fn(),
      getState: vi.fn(() => ({ role: AgentRole.MANAGER, status: 'running' })),
      dispatch: vi.fn(() => [])
    };

    const next = await runManagerPlanStage(
      task,
      { goal: task.goal, sessionId: 'session:test' },
      { retryCount: 0, maxRetries: 2, dispatches: [] } as any,
      libu as any,
      callbacks as any
    );

    expect(task.planMode).toBe('finalized');
    expect(task.planDraft?.decisions?.[0]?.resolutionSource).toBe('fallback-assumption');
    expect(task.planDraft?.decisions?.[0]?.assumedValue).toContain('最小改动');
    expect((next as any).terminateAfterPlanning).toBe(true);
    expect(task.result).toContain('## 默认假设');
  });

  it('enforces planning micro-budget and blocks excess readonly exploration', async () => {
    const now = new Date().toISOString();
    vi.mocked(interrupt).mockReturnValue({ action: 'bypass' } as never);
    const task = createPlanningTask('/plan-eng-review 为 agent-chat 增加计划模式');
    task.specialistLead = {
      id: 'specialist:architect',
      displayName: '架构专家',
      domain: 'architecture',
      reason: '负责主链演进'
    } as any;
    task.capabilityAttachments = [
      {
        id: 'skill:planner',
        displayName: 'Planning helper',
        kind: 'skill',
        owner: {
          ownerType: 'user-attached',
          ownerId: 'session:test',
          capabilityType: 'skill',
          scope: 'workspace',
          trigger: 'user_requested'
        },
        enabled: true,
        metadata: {
          steps: [{ title: 'Inspect constraints', instruction: 'Read constraints.', toolNames: ['read_local_file'] }]
        }
      } as any
    ];
    const callbacks = createCallbacks(now);
    const libu = {
      plan: vi.fn(),
      getState: vi.fn(() => ({ role: AgentRole.MANAGER, status: 'running' })),
      dispatch: vi.fn(() => [])
    };

    await runManagerPlanStage(
      task,
      { goal: task.goal, sessionId: 'session:test', context: '需要兼顾现有运行链路与 UI 表达。' },
      { retryCount: 0, maxRetries: 2, dispatches: [] } as any,
      libu as any,
      callbacks as any
    );

    expect(task.planDraft?.microBudget?.readOnlyToolsUsed).toBe(3);
    expect(task.planDraft?.microBudget?.budgetTriggered).toBe(true);
    const explorationSummaries =
      task.planDraft?.autoResolved.filter(item =>
        ['已命中流程模板：', '用户已提供额外上下文', '主导专家已确定为：', '已挂载技能线索：'].some(prefix =>
          item.startsWith(prefix)
        )
      ) ?? [];
    expect(explorationSummaries.length).toBeLessThanOrEqual(3);
    expect(callbacks.recordToolUsage).toHaveBeenCalledWith(
      task,
      expect.objectContaining({
        toolName: 'planning.skill_contract_inspect',
        status: 'blocked',
        family: 'plan-readonly'
      })
    );
  });

  it('supports imperial_direct mode and skips group planning', async () => {
    const now = new Date().toISOString();
    const task = createPlanningTask('/exec 直接执行当前修复');
    task.executionPlan = {
      mode: 'imperial_direct',
      modeCapabilities: ['imperial-fast-path']
    };
    const callbacks = createCallbacks(now);
    const libu = {
      plan: vi.fn(),
      getState: vi.fn(() => ({ role: AgentRole.MANAGER, status: 'running' })),
      dispatch: vi.fn(() => [])
    };

    await runManagerPlanStage(
      task,
      { goal: task.goal, sessionId: 'session:test', requestedMode: 'imperial_direct' },
      { retryCount: 0, maxRetries: 2, dispatches: [] } as any,
      libu as any,
      callbacks as any
    );

    expect(task.executionMode).toBe('imperial_direct');
    expect(task.currentNode).toBe('imperial_direct_dispatch');
    expect(libu.plan).not.toHaveBeenCalled();
    expect(task.trace).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          node: 'mode_transition'
        })
      ])
    );
  });
});
