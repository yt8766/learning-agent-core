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

  const createOrchestrator = (snapshot?: any, options?: { memorySearchResults?: any[]; ruleSearchResults?: any[] }) => {
    return new AgentOrchestrator({
      memoryRepository: {
        append: vi.fn(),
        search: vi.fn(async () => options?.memorySearchResults ?? []),
        getById: vi.fn()
      } as never,
      memorySearchService: {
        search: vi.fn(async () => ({
          memories: options?.memorySearchResults ?? [],
          rules: options?.ruleSearchResults ?? []
        }))
      } as never,
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
      constraints: [],
      sessionId: 'session-direct-reply'
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

  it('普通对话消息默认走 direct reply 快路径，便于前端流式返回', async () => {
    const orchestrator = createOrchestrator();

    await orchestrator.initialize();

    const task = await orchestrator.createTask({
      goal: '解释一下这个系统能做什么',
      constraints: [],
      sessionId: 'session-general-chat'
    });

    expect(task.status).toBe(TaskStatus.COMPLETED);
    expect(task.trace).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          node: 'direct_reply'
        })
      ])
    );
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
    expect(task.trace).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          node: 'supervisor_planned'
        })
      ])
    );
  });

  it('显式 Skill 命令会解析成流程模板并写入任务状态', async () => {
    const orchestrator = createOrchestrator();

    await orchestrator.initialize();

    const task = await orchestrator.createTask({
      goal: '/review 请审查这个仓库的潜在风险',
      constraints: [],
      sessionId: 'session-review'
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

  it('创建任务时会把 memory search 命中的规则也写入复用状态与证据', async () => {
    const orchestrator = createOrchestrator(undefined, {
      memorySearchResults: [
        {
          id: 'mem_release_check',
          type: 'success_case',
          summary: '发布前先跑 build',
          content: 'Run build first.',
          tags: ['release'],
          createdAt: '2026-03-22T00:00:00.000Z',
          status: 'active'
        }
      ],
      ruleSearchResults: [
        {
          id: 'rule_release_gate',
          name: 'release_gate',
          summary: '发布前必须通过 build',
          conditions: ['before release'],
          action: 'run build',
          createdAt: '2026-03-22T00:00:00.000Z',
          status: 'active'
        }
      ]
    });

    await orchestrator.initialize();

    const task = await orchestrator.createTask({
      goal: '/ship 帮我整理发布前检查',
      constraints: [],
      sessionId: 'session-ship'
    });

    expect(task.reusedMemories).toContain('mem_release_check');
    expect(task.reusedRules).toContain('rule_release_gate');
    expect(task.externalSources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sourceType: 'memory_reuse' }),
        expect.objectContaining({ sourceType: 'rule_reuse' })
      ])
    );
  });

  it('创建任务时会把本地 skill search 结果写入 task.skillSearch', async () => {
    const orchestrator = createOrchestrator();

    orchestrator.setLocalSkillSuggestionResolver(async () => ({
      capabilityGapDetected: true,
      status: 'suggested',
      safetyNotes: ['Release Check：installable，不依赖额外连接器。'],
      suggestions: [
        {
          id: 'release_check',
          kind: 'manifest',
          displayName: 'Release Check',
          summary: '执行发布前检查',
          sourceId: 'workspace-skills',
          score: 0.9,
          availability: 'installable',
          reason: '当前 profile 可从本地来源安装。',
          requiredCapabilities: ['release-ops'],
          requiredConnectors: ['ci'],
          version: '0.1.0'
        }
      ]
    }));

    await orchestrator.initialize();

    const task = await orchestrator.createTask({
      goal: '/ship 帮我做发布前检查',
      constraints: [],
      sessionId: 'session-ship-skill-search'
    });

    expect(task.skillSearch).toEqual(
      expect.objectContaining({
        capabilityGapDetected: true,
        status: 'suggested',
        suggestions: [expect.objectContaining({ id: 'release_check' })]
      })
    );
  });

  it('创建 freshness-sensitive 任务时会写入 freshness 元证据', async () => {
    const orchestrator = createOrchestrator();

    await orchestrator.initialize();

    const task = await orchestrator.createTask({
      goal: '最近 AI 有没有什么新的技术进展',
      constraints: [],
      sessionId: 'session-freshness'
    });

    expect(task.externalSources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceType: 'freshness_meta',
          trustClass: 'internal',
          summary: expect.stringContaining('信息基准日期：'),
          detail: expect.objectContaining({
            freshnessSensitive: true,
            sourceCount: expect.any(Number)
          })
        })
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
      constraints: [],
      sessionId: 'session-ship'
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
      constraints: [],
      sessionId: 'session-browse'
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
      constraints: [],
      sessionId: 'session-qa'
    });

    expect(task.skillId).toBe('qa');
    expect(task.pendingAction).toEqual(
      expect.objectContaining({
        toolName: 'run_terminal'
      })
    );
  });

  it('后续任务会优先命中已沉淀的 research memory', async () => {
    const orchestrator = createOrchestrator(undefined, {
      memorySearchResults: [
        {
          id: 'mem_research_existing',
          type: 'fact',
          taskId: 'learn_job_1',
          summary: 'React 官方文档关于流式渲染的研究结论',
          content: '优先复用此前主动研究沉淀的结论。',
          tags: ['research-job', 'auto-persist', 'react'],
          qualityScore: 92,
          createdAt: '2026-03-23T00:00:00.000Z'
        }
      ]
    });

    await orchestrator.initialize();

    const task = await orchestrator.createTask({
      goal: '/review 请审查 React 聊天页的流式渲染体验',
      constraints: [],
      sessionId: 'session-memory'
    });

    expect(task.reusedMemories).toEqual(['mem_research_existing']);
    expect(task.externalSources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceType: 'memory_reuse',
          trustClass: 'internal',
          detail: expect.objectContaining({
            memoryId: 'mem_research_existing'
          })
        })
      ])
    );
    expect(task.trace).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          node: 'research',
          summary: expect.stringContaining('优先命中 1 条历史记忆')
        })
      ])
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
});
