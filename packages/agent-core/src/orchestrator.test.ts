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

  const createOrchestrator = (snapshot?: any) => {
    return new AgentOrchestrator(
      { append: vi.fn(), search: vi.fn(), getById: vi.fn() } as never,
      { publishToLab: vi.fn(), list: vi.fn(), getById: vi.fn(), promote: vi.fn(), disable: vi.fn() } as never,
      { requiresApproval: vi.fn(), getDefaultDecision: vi.fn() } as never,
      createRuntimeRepository(snapshot) as never
    ) as any;
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
});
