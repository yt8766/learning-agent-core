import { describe, expect, it, vi } from 'vitest';

import { ActionIntent, TaskStatus } from '@agent/shared';

import { AgentOrchestrator } from './graphs/main.graph';

describe('AgentOrchestrator', () => {
  const createRuntimeRepository = (snapshot?: any) => ({
    load: vi.fn(
      async () =>
        snapshot ?? {
          tasks: [],
          learningJobs: [],
          pendingExecutions: [],
          chatSessions: [],
          chatMessages: [],
          chatEvents: [],
          chatCheckpoints: []
        }
    ),
    save: vi.fn(async () => undefined)
  });

  const createLlmProvider = () => ({
    isConfigured: vi.fn(() => false),
    generateText: vi.fn(async () => ''),
    streamText: vi.fn(async () => ''),
    generateObject: vi.fn()
  });

  const createOrchestrator = (snapshot?: any) => {
    return new AgentOrchestrator({
      memoryRepository: { append: vi.fn(), search: vi.fn(async () => []), getById: vi.fn() } as never,
      skillRegistry: {
        publishToLab: vi.fn(),
        list: vi.fn(async () => []),
        getById: vi.fn(),
        promote: vi.fn(),
        disable: vi.fn()
      } as never,
      approvalService: {
        requiresApproval: vi.fn((intent: ActionIntent, tool?: { requiresApproval?: boolean }) => {
          return (
            intent === ActionIntent.WRITE_FILE ||
            intent === ActionIntent.CALL_EXTERNAL_API ||
            Boolean(tool?.requiresApproval)
          );
        }),
        getDefaultDecision: vi.fn((intent: ActionIntent, tool?: { requiresApproval?: boolean }) =>
          intent === ActionIntent.WRITE_FILE ||
          intent === ActionIntent.CALL_EXTERNAL_API ||
          Boolean(tool?.requiresApproval)
            ? 'pending'
            : 'approved'
        )
      } as never,
      runtimeStateRepository: createRuntimeRepository(snapshot) as never,
      llmProvider: createLlmProvider() as never,
      ruleRepository: { list: vi.fn(), append: vi.fn() } as never,
      sandboxExecutor: {
        execute: vi.fn(async () => ({
          ok: true,
          outputSummary: 'sandbox executed',
          durationMs: 1,
          exitCode: 0
        }))
      } as never
    }) as any;
  };

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
      constraints: []
    });

    expect(task.status).toBe(TaskStatus.COMPLETED);
    expect(task.currentStep).toBe('direct_reply');
    expect(task.result).toContain('多 Agent');
    expect(task.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'summary'
        })
      ])
    );
  });

  it('显式 Skill 命令会解析成流程模板并写入任务状态', async () => {
    const orchestrator = createOrchestrator();

    await orchestrator.initialize();

    const task = await orchestrator.createTask({
      goal: '/review 请审查这个仓库的潜在风险',
      constraints: []
    });

    expect(task.goal).toBe('请审查这个仓库的潜在风险');
    expect(task.skillId).toBe('review');
    expect(task.skillStage).toBe('completed');
    expect(task.resolvedWorkflow).toEqual(
      expect.objectContaining({
        id: 'review',
        displayName: '代码审查流程'
      })
    );
    expect(task.trace).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ node: 'skill_resolved' }),
        expect.objectContaining({ node: 'skill_stage_started' }),
        expect.objectContaining({ node: 'skill_stage_completed' })
      ])
    );
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

  it('发布类 Skill 会优先路由兵部执行链路', async () => {
    const orchestrator = createOrchestrator();

    await orchestrator.initialize();

    const task = await orchestrator.createTask({
      goal: '/ship 请整理本次发布前检查',
      constraints: []
    });

    expect(task.skillId).toBe('ship');
    expect(task.modelRoute).toEqual(expect.arrayContaining([expect.objectContaining({ ministry: 'bingbu-ops' })]));
    expect(task.trace).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          node: 'ministry_started',
          data: expect.objectContaining({ ministry: 'bingbu-ops' })
        })
      ])
    );
    expect(task.pendingAction?.toolName).toBe('ship_release');
  });

  it('浏览器类 Skill 会优先选择 browse_page 能力并进入审批', async () => {
    const orchestrator = createOrchestrator();

    await orchestrator.initialize();

    const task = await orchestrator.createTask({
      goal: '/browse 帮我打开首页并检查按钮',
      constraints: []
    });

    expect(task.skillId).toBe('browse');
    expect(task.status).toBe(TaskStatus.WAITING_APPROVAL);
    expect(task.pendingAction).toEqual(
      expect.objectContaining({
        toolName: 'browse_page'
      })
    );
  });

  it('QA Skill 会优先选择 run_terminal 能力', async () => {
    const orchestrator = createOrchestrator();

    await orchestrator.initialize();

    const task = await orchestrator.createTask({
      goal: '/qa 帮我回归测试聊天主链路',
      constraints: []
    });

    expect(task.skillId).toBe('qa');
    expect(task.pendingAction).toEqual(
      expect.objectContaining({
        toolName: 'run_terminal'
      })
    );
  });
});
