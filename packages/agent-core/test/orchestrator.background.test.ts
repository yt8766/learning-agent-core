import { describe, expect, it, vi } from 'vitest';

import { TaskStatus } from '@agent/shared';

import { createOrchestrator } from './orchestrator.test.utils';

// task.activeInterrupt remains the persisted 司礼监 / InterruptController projection in background-task fixtures.
describe('AgentOrchestrator background flows', () => {
  it('无 sessionId 的任务只入队后台执行，不会在 createTask 时同步推进', async () => {
    const orchestrator = createOrchestrator();
    orchestrator.runTaskPipeline = vi.fn(async () => undefined);

    await orchestrator.initialize();

    const task = await orchestrator.createTask({
      goal: '后台批量整理发布清单',
      constraints: []
    });

    expect(task.queueState).toEqual(
      expect.objectContaining({
        backgroundRun: true,
        mode: 'background',
        status: 'queued'
      })
    );
    expect(task.status).toBe(TaskStatus.QUEUED);
    expect(orchestrator.runTaskPipeline).not.toHaveBeenCalled();
    expect(task.trace).toEqual(expect.arrayContaining([expect.objectContaining({ node: 'background_queued' })]));
  });

  it('后台 lease 过期后会在 retry budget 内重新入队', async () => {
    const now = new Date('2026-03-25T00:00:00.000Z');
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const orchestrator = createOrchestrator({
      tasks: [
        {
          id: 'task-bg-requeue',
          runId: 'run-bg-requeue',
          goal: '后台执行重试',
          status: TaskStatus.RUNNING,
          trace: [],
          approvals: [],
          agentStates: [],
          messages: [],
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
          retryCount: 0,
          maxRetries: 1,
          budgetState: {
            stepBudget: 8,
            stepsConsumed: 1,
            retryBudget: 1,
            retriesConsumed: 0,
            sourceBudget: 8,
            sourcesConsumed: 0
          },
          queueState: {
            mode: 'background',
            backgroundRun: true,
            status: 'running',
            enqueuedAt: now.toISOString(),
            startedAt: now.toISOString(),
            lastTransitionAt: now.toISOString(),
            attempt: 1,
            leaseOwner: 'runtime-1',
            leaseExpiresAt: new Date(now.getTime() - 1_000).toISOString(),
            lastHeartbeatAt: now.toISOString()
          }
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

    const task = await orchestrator.reclaimExpiredBackgroundLease('task-bg-requeue', 'runtime-1');

    expect(task).toEqual(
      expect.objectContaining({
        status: TaskStatus.QUEUED,
        currentNode: 'background_requeued',
        queueState: expect.objectContaining({
          status: 'queued',
          attempt: 2,
          leaseOwner: undefined
        }),
        retryCount: 1,
        budgetState: expect.objectContaining({
          retriesConsumed: 1
        })
      })
    );
    vi.useRealTimers();
  });

  it('后台 lease 过期且耗尽 retry budget 时会终止任务', async () => {
    const now = new Date('2026-03-25T00:00:00.000Z');
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const orchestrator = createOrchestrator({
      tasks: [
        {
          id: 'task-bg-fail',
          runId: 'run-bg-fail',
          goal: '后台执行终止',
          status: TaskStatus.RUNNING,
          trace: [],
          approvals: [],
          agentStates: [],
          messages: [],
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
          retryCount: 1,
          maxRetries: 1,
          budgetState: {
            stepBudget: 8,
            stepsConsumed: 1,
            retryBudget: 1,
            retriesConsumed: 1,
            sourceBudget: 8,
            sourcesConsumed: 0
          },
          queueState: {
            mode: 'background',
            backgroundRun: true,
            status: 'running',
            enqueuedAt: now.toISOString(),
            startedAt: now.toISOString(),
            lastTransitionAt: now.toISOString(),
            attempt: 2,
            leaseOwner: 'runtime-1',
            leaseExpiresAt: new Date(now.getTime() - 1_000).toISOString(),
            lastHeartbeatAt: now.toISOString()
          }
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

    const task = await orchestrator.reclaimExpiredBackgroundLease('task-bg-fail', 'runtime-1');

    expect(task).toEqual(
      expect.objectContaining({
        status: TaskStatus.FAILED,
        currentNode: 'background_reclaim_failed',
        currentStep: 'background_runner_failed',
        queueState: expect.objectContaining({
          status: 'failed',
          leaseOwner: undefined
        }),
        result: expect.stringContaining('retry budget')
      })
    );
    vi.useRealTimers();
  });

  it('审批中断超时后会默认拒绝并终止任务', async () => {
    const now = new Date('2026-03-25T00:00:00.000Z');
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const orchestrator = createOrchestrator({
      tasks: [
        {
          id: 'task-timeout-approval',
          runId: 'run-timeout-approval',
          goal: '危险写入操作',
          status: TaskStatus.WAITING_APPROVAL,
          trace: [],
          approvals: [],
          agentStates: [],
          messages: [],
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
          activeInterrupt: {
            id: 'interrupt-timeout-approval',
            status: 'pending',
            mode: 'blocking',
            source: 'graph',
            kind: 'tool-approval',
            interactionKind: 'approval',
            reason: '等待审批',
            resumeStrategy: 'approval-recovery',
            timeoutMinutes: 30,
            timeoutPolicy: 'reject',
            createdAt: new Date(now.getTime() - 31 * 60_000).toISOString()
          },
          pendingApproval: {
            toolName: 'write_file',
            intent: 'write_file',
            requestedBy: 'gongbu-code'
          }
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
    const [task] = await orchestrator.sweepInterruptTimeouts();

    expect(task).toEqual(
      expect.objectContaining({
        id: 'task-timeout-approval',
        status: TaskStatus.CANCELLED,
        currentStep: 'approval_timeout',
        result: '审批超时，系统已默认拒绝并终止任务。'
      })
    );
    vi.useRealTimers();
  });

  it('计划问题超时后会按默认值继续执行', async () => {
    const now = new Date('2026-03-25T00:00:00.000Z');
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const orchestrator = createOrchestrator({
      tasks: [
        {
          id: 'task-timeout-plan',
          runId: 'run-timeout-plan',
          goal: '先给我方案',
          status: TaskStatus.WAITING_APPROVAL,
          trace: [],
          approvals: [],
          agentStates: [],
          messages: [],
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
          planMode: 'implementation',
          executionPlan: { mode: 'plan' },
          planDraft: {
            summary: '方案待确认',
            autoResolved: [],
            openQuestions: ['交付方式'],
            assumptions: [],
            questions: [
              {
                id: 'delivery_mode',
                question: '是只出方案还是直接实现',
                questionType: 'tradeoff',
                options: [{ id: 'implement_now', label: '直接实现', description: '直接进入实现' }],
                recommendedOptionId: 'implement_now',
                defaultAssumption: '先采用最小实现路径'
              }
            ]
          },
          activeInterrupt: {
            id: 'interrupt-timeout-plan',
            status: 'pending',
            mode: 'blocking',
            source: 'graph',
            kind: 'user-input',
            interactionKind: 'plan-question',
            reason: '等待计划问题回答',
            resumeStrategy: 'command',
            timeoutMinutes: 30,
            timeoutPolicy: 'default-continue',
            createdAt: new Date(now.getTime() - 31 * 60_000).toISOString(),
            payload: { interactionKind: 'plan-question' }
          }
        }
      ],
      learningJobs: [],
      pendingExecutions: [],
      chatSessions: [],
      chatMessages: [],
      chatEvents: [],
      chatCheckpoints: []
    });
    orchestrator.runTaskPipeline = vi.fn(async () => undefined);

    await orchestrator.initialize();
    const [task] = await orchestrator.sweepInterruptTimeouts();

    expect(task).toEqual(
      expect.objectContaining({
        id: 'task-timeout-plan',
        status: TaskStatus.COMPLETED,
        executionMode: 'execute',
        planMode: 'finalized'
      })
    );
    expect(task.planDraft?.assumptions).toContain('部分计划问题因超时采用了默认值。');
    expect(task.learningEvaluation?.timeoutStats).toEqual(
      expect.objectContaining({
        count: 1,
        defaultAppliedCount: 1
      })
    );
    expect(task.trace.some((item: { node?: string }) => item.node === 'interrupt_timeout')).toBe(true);
    expect(task.result).toBeTruthy();
    vi.useRealTimers();
  });

  it('learning queue 会优先处理高优先级条目并自动确认可沉淀候选', async () => {
    const orchestrator = createOrchestrator({
      tasks: [
        {
          id: 'task-learning-high',
          runId: 'run-learning-high',
          goal: '沉淀高优先级学习项',
          status: TaskStatus.COMPLETED,
          trace: [],
          approvals: [],
          agentStates: [],
          messages: [],
          learningQueueItemId: 'learning_queue_task-learning-high',
          learningEvaluation: {
            score: 92,
            confidence: 'high',
            notes: [],
            recommendedCandidateIds: ['candidate-1'],
            autoConfirmCandidateIds: ['candidate-1'],
            sourceSummary: {
              externalSourceCount: 0,
              internalSourceCount: 1,
              reusedMemoryCount: 0,
              reusedRuleCount: 0,
              reusedSkillCount: 0
            }
          },
          learningCandidates: [
            {
              id: 'candidate-1',
              taskId: 'task-learning-high',
              type: 'memory',
              summary: '自动沉淀候选',
              status: 'pending_confirmation',
              autoConfirmEligible: true,
              payload: {
                id: 'mem-candidate-1',
                type: 'task_summary',
                taskId: 'task-learning-high',
                summary: '自动沉淀候选',
                content: 'content',
                tags: ['task-experience'],
                createdAt: '2026-03-25T00:00:00.000Z'
              },
              createdAt: '2026-03-25T00:00:00.000Z'
            }
          ],
          createdAt: '2026-03-25T00:00:00.000Z',
          updatedAt: '2026-03-25T00:00:00.000Z'
        }
      ],
      learningJobs: [],
      learningQueue: [
        {
          id: 'learning_queue_task-learning-high',
          taskId: 'task-learning-high',
          runId: 'run-learning-high',
          status: 'queued',
          priority: 'high',
          reason: 'high_risk_failure',
          trace: [],
          queuedAt: '2026-03-25T00:00:00.000Z',
          updatedAt: '2026-03-25T00:00:00.000Z'
        }
      ],
      pendingExecutions: [],
      chatSessions: [],
      chatMessages: [],
      chatEvents: [],
      chatCheckpoints: []
    });

    await orchestrator.initialize();

    const [queueItem] = await orchestrator.processLearningQueue();
    const task = orchestrator.listTasks().find((item: any) => item.id === 'task-learning-high');

    expect(queueItem).toEqual(
      expect.objectContaining({
        id: 'learning_queue_task-learning-high',
        status: 'completed'
      })
    );
    expect(task?.learningCandidates).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'candidate-1', status: 'confirmed' })])
    );
  });
});
