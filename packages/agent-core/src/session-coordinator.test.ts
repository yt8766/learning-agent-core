import { describe, expect, it, vi } from 'vitest';

vi.mock('./adapters/llm/zhipu-provider', () => ({
  ZhipuLlmProvider: class {
    isConfigured() {
      return false;
    }

    async generateText() {
      return '';
    }
  }
}));

import { ActionIntent, TaskStatus } from '@agent/shared';

import { SessionCoordinator } from './session/session-coordinator';

const flushAsyncWork = async (times = 3) => {
  for (let index = 0; index < times; index += 1) {
    await new Promise(resolve => setTimeout(resolve, 0));
  }
};

describe('SessionCoordinator', () => {
  const createRuntimeRepository = () => {
    let snapshot = {
      tasks: [],
      learningJobs: [],
      pendingExecutions: [],
      chatSessions: [],
      chatMessages: [],
      chatEvents: [],
      chatCheckpoints: []
    };

    return {
      load: vi.fn(async () => structuredClone(snapshot)),
      save: vi.fn(async next => {
        snapshot = structuredClone(next);
      })
    };
  };

  const createOrchestrator = () => {
    const listeners = new Set<(task: any) => void>();
    const tokenListeners = new Set<(event: any) => void>();
    const tasks = new Map<string, any>();
    const api = {
      initialize: vi.fn(async () => undefined),
      subscribe: vi.fn((listener: (task: any) => void) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      }),
      subscribeTokens: vi.fn((listener: (event: any) => void) => {
        tokenListeners.add(listener);
        return () => tokenListeners.delete(listener);
      }),
      createTask: vi.fn(async dto => {
        const task = {
          id: 'task-1',
          goal: dto.goal,
          sessionId: dto.sessionId,
          status: TaskStatus.COMPLETED,
          trace: [
            {
              node: 'manager_plan',
              at: '2026-03-22T00:00:00.000Z',
              summary: 'manager planned'
            }
          ],
          approvals: [],
          agentStates: [],
          messages: [
            {
              id: 'task-msg-1',
              taskId: 'task-1',
              from: 'research',
              to: 'manager',
              type: 'research_result',
              content: 'Research found package metadata.',
              createdAt: '2026-03-22T00:00:00.000Z'
            },
            {
              id: 'task-msg-2',
              taskId: 'task-1',
              from: 'manager',
              to: 'manager',
              type: 'summary',
              content: 'Execution completed successfully.',
              createdAt: '2026-03-22T00:00:01.000Z'
            }
          ],
          result: 'Execution completed successfully.',
          createdAt: '2026-03-22T00:00:00.000Z',
          updatedAt: '2026-03-22T00:00:00.000Z',
          currentStep: 'finish',
          retryCount: 0,
          maxRetries: 1
        };

        tasks.set(task.id, task);
        listeners.forEach(listener => listener(task));
        return task;
      }),
      getTask: vi.fn((taskId: string) => tasks.get(taskId)),
      ensureLearningCandidates: vi.fn((task: any) => task.learningCandidates ?? []),
      confirmLearning: vi.fn(async (taskId: string, candidateIds?: string[]) => {
        const task = api.getTask(taskId) ?? tasks.get(taskId);
        if (!task) {
          return undefined;
        }

        if (task.learningCandidates?.length) {
          const selected = new Set(candidateIds ?? task.learningCandidates.map((candidate: any) => candidate.id));
          task.learningCandidates = task.learningCandidates.map((candidate: any) =>
            selected.has(candidate.id)
              ? { ...candidate, status: 'confirmed', confirmedAt: '2026-03-22T00:00:00.000Z' }
              : candidate
          );
        }

        return task;
      }),
      applyApproval: vi.fn()
    };

    return api;
  };

  const createLlmProvider = () => ({
    isConfigured: vi.fn(() => false),
    generateText: vi.fn(async () => ''),
    streamText: vi.fn(async () => ''),
    generateObject: vi.fn()
  });

  it('创建会话后会写入初始消息、事件和 checkpoint', async () => {
    const runtimeRepository = createRuntimeRepository();
    const orchestrator = createOrchestrator();
    const coordinator = new SessionCoordinator(
      orchestrator as never,
      runtimeRepository as never,
      createLlmProvider() as never
    );

    const session = await coordinator.createSession({ title: '测试会话', message: '你好，Agent' });

    expect(session.title).toBe('测试会话');
    expect(coordinator.getMessages(session.id)).toEqual([
      expect.objectContaining({ role: 'user', content: '你好，Agent' })
    ]);
    expect(coordinator.getEvents(session.id)).toEqual([
      expect.objectContaining({ type: 'session_started' }),
      expect.objectContaining({ type: 'user_message' })
    ]);

    await flushAsyncWork();

    expect(orchestrator.createTask).toHaveBeenCalledWith({
      goal: '你好，Agent',
      context: 'user: 你好，Agent',
      constraints: [],
      sessionId: session.id
    });
    expect(coordinator.getSession(session.id)?.currentTaskId).toBe('task-1');
    expect(coordinator.getSession(session.id)?.status).toBe('completed');
    expect(coordinator.getEvents(session.id)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'manager_planned' }),
        expect.objectContaining({ type: 'research_progress' }),
        expect.objectContaining({ type: 'assistant_message' })
      ])
    );
    expect(coordinator.getMessages(session.id)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ role: 'user', content: expect.stringContaining('Agent') }),
        expect.objectContaining({
          role: 'assistant',
          linkedAgent: 'manager',
          content: 'Execution completed successfully.'
        })
      ])
    );
    expect(coordinator.getMessages(session.id)).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: 'assistant',
          linkedAgent: 'research',
          content: 'Research found package metadata.'
        })
      ])
    );
    expect(coordinator.getCheckpoint(session.id)).toEqual(
      expect.objectContaining({
        taskId: 'task-1',
        graphState: expect.objectContaining({ status: TaskStatus.COMPLETED })
      })
    );
    expect(runtimeRepository.save).toHaveBeenCalled();
  });

  it('创建任务时会把 memory search 结果注入 context', async () => {
    const runtimeRepository = createRuntimeRepository();
    const orchestrator = createOrchestrator();
    const coordinator = new SessionCoordinator(
      orchestrator as never,
      runtimeRepository as never,
      createLlmProvider() as never,
      undefined,
      {
        search: vi.fn(async () => ({
          memories: [
            {
              id: 'mem_build_policy',
              type: 'success_case',
              taskId: 'task_prev',
              summary: '构建前先做类型检查',
              content: 'Run tsc before build.',
              tags: ['build'],
              qualityScore: 0.9,
              createdAt: '2026-03-22T00:00:00.000Z',
              status: 'active'
            }
          ],
          rules: [
            {
              id: 'rule_build_gate',
              summary: '发布前必须通过构建',
              ruleText: 'Build must pass before release.',
              tags: ['release'],
              createdAt: '2026-03-22T00:00:00.000Z',
              status: 'active'
            }
          ]
        }))
      } as never
    );

    const session = await coordinator.createSession({ title: '检索注入', message: '帮我构建并检查发布风险' });

    await flushAsyncWork();

    const createTaskArg = (orchestrator.createTask as any).mock.calls[0][0];
    expect(createTaskArg.goal).toBe('帮我构建并检查发布风险');
    expect(createTaskArg.sessionId).toBe(session.id);
    expect(createTaskArg.constraints).toEqual([]);
    expect(createTaskArg.context).toContain('本轮按当前目标再检索出的历史 memory');
    expect(createTaskArg.context).toContain('构建前先做类型检查');
    expect(createTaskArg.context).toContain('发布前必须通过构建');
  });

  it('会保留不同轮次中内容相同的 assistant 最终回复', async () => {
    const runtimeRepository = createRuntimeRepository();
    const listeners = new Set<(task: any) => void>();
    const tokenListeners = new Set<(event: any) => void>();
    let taskCount = 0;
    const orchestrator = {
      initialize: vi.fn(async () => undefined),
      subscribe: vi.fn((listener: (task: any) => void) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      }),
      subscribeTokens: vi.fn((listener: (event: any) => void) => {
        tokenListeners.add(listener);
        return () => tokenListeners.delete(listener);
      }),
      createTask: vi.fn(async (dto: any) => {
        taskCount += 1;
        const task = {
          id: `task-${taskCount}`,
          goal: dto.goal,
          sessionId: dto.sessionId,
          status: TaskStatus.COMPLETED,
          trace: [],
          approvals: [],
          agentStates: [],
          messages: [
            {
              id: `task-msg-${taskCount}`,
              taskId: `task-${taskCount}`,
              from: 'manager',
              to: 'manager',
              type: 'summary',
              content: '我是一个多 Agent 协作助手。',
              createdAt: `2026-03-22T00:00:0${taskCount}.000Z`
            }
          ],
          result: '我是一个多 Agent 协作助手。',
          createdAt: `2026-03-22T00:00:0${taskCount}.000Z`,
          updatedAt: `2026-03-22T00:00:0${taskCount}.000Z`,
          currentStep: 'finish',
          retryCount: 0,
          maxRetries: 1
        };

        listeners.forEach(listener => listener(task));
        return task;
      }),
      getTask: vi.fn(() => undefined),
      ensureLearningCandidates: vi.fn((task: any) => task.learningCandidates ?? []),
      confirmLearning: vi.fn(),
      applyApproval: vi.fn()
    };

    const coordinator = new SessionCoordinator(
      orchestrator as never,
      runtimeRepository as never,
      createLlmProvider() as never
    );

    const session = await coordinator.createSession({ title: '重复回复测试' });
    await coordinator.appendMessage(session.id, { message: '你是谁' });
    await flushAsyncWork();
    await coordinator.appendMessage(session.id, { message: '你是谁啊' });
    await flushAsyncWork();

    const assistantMessages = coordinator.getMessages(session.id).filter(message => message.role === 'assistant');
    expect(assistantMessages).toHaveLength(2);
    expect(assistantMessages[0]?.content).toBe('我是一个多 Agent 协作助手。');
    expect(assistantMessages[1]?.content).toBe('我是一个多 Agent 协作助手。');
  });

  it('创建空会话时只写入 session_started，不自动触发任务', async () => {
    const runtimeRepository = createRuntimeRepository();
    const orchestrator = createOrchestrator();
    const coordinator = new SessionCoordinator(
      orchestrator as never,
      runtimeRepository as never,
      createLlmProvider() as never
    );

    const session = await coordinator.createSession({ title: '空会话' });

    expect(session.title).toBe('空会话');
    expect(coordinator.getMessages(session.id)).toEqual([]);
    expect(coordinator.getEvents(session.id)).toEqual([expect.objectContaining({ type: 'session_started' })]);
    expect(orchestrator.createTask).not.toHaveBeenCalled();
  });

  it('订阅者可以收到新增事件', async () => {
    const runtimeRepository = createRuntimeRepository();
    const orchestrator = createOrchestrator();
    const coordinator = new SessionCoordinator(
      orchestrator as never,
      runtimeRepository as never,
      createLlmProvider() as never
    );
    const session = await coordinator.createSession({ title: '事件订阅', message: '第一条消息' });
    const listener = vi.fn();
    const unsubscribe = coordinator.subscribe(session.id, listener);

    await coordinator.appendMessage(session.id, { message: '第二条消息' });

    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: session.id,
        type: 'user_message'
      })
    );

    unsubscribe();
    const callCount = listener.mock.calls.length;
    await coordinator.appendMessage(session.id, { message: '第三条消息' });
    expect(listener).toHaveBeenCalledTimes(callCount);
  });

  it('聊天记录过长时会自动压缩旧消息并保留最近上下文', async () => {
    const runtimeRepository = createRuntimeRepository();
    const orchestrator = createOrchestrator();
    const coordinator = new SessionCoordinator(
      orchestrator as never,
      runtimeRepository as never,
      createLlmProvider() as never
    );

    const session = await coordinator.createSession({ title: '自动压缩', message: '第一条消息：请记住我是中文用户。' });
    await flushAsyncWork();

    for (let index = 0; index < 18; index += 1) {
      await coordinator.appendMessage(session.id, {
        message: `后续消息 ${index + 1}：这是为了触发自动压缩的测试内容。`
      });
      await flushAsyncWork();
    }

    await flushAsyncWork(8);

    const currentSession = coordinator.getSession(session.id);
    expect(currentSession?.compression).toEqual(
      expect.objectContaining({
        source: 'heuristic'
      })
    );
    expect(currentSession?.compression?.condensedMessageCount).toBeGreaterThan(0);
    expect(coordinator.getEvents(session.id)).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: 'conversation_compacted' })])
    );

    const compactedContext = await (coordinator as any).buildConversationContext(session.id, '继续总结当前会话');
    expect(compactedContext).toContain('以下是较早聊天记录的压缩摘要：');
    expect(compactedContext).toContain('以下是最近的原始消息：');
  });

  it('buildConversationContext 会注入 checkpoint 中的 evidence、memory、learning 和上轮上下文', async () => {
    const runtimeRepository = createRuntimeRepository();
    const orchestrator = createOrchestrator();
    const coordinator = new SessionCoordinator(
      orchestrator as never,
      runtimeRepository as never,
      createLlmProvider() as never
    );

    const session = await coordinator.createSession({ title: 'context-slice', message: '请继续刚才的研究' });
    await flushAsyncWork();

    const checkpoint = coordinator.getCheckpoint(session.id)!;
    checkpoint.context = '上轮已经确认要优先参考内部文档，再补充官方资料。';
    checkpoint.reusedMemories = ['mem_internal_guideline'];
    checkpoint.reusedRules = ['rule_safe_release'];
    checkpoint.reusedSkills = ['skill_release_check'];
    checkpoint.externalSources = [
      {
        id: 'ev-1',
        taskId: 'task-1',
        sourceType: 'web',
        trustClass: 'official',
        summary: 'React 官方文档对流式渲染的说明',
        sourceUrl: 'https://react.dev',
        linkedRunId: 'run-1',
        createdAt: '2026-03-25T00:00:00.000Z'
      }
    ];
    checkpoint.learningEvaluation = {
      score: 0.92,
      confidence: 'high',
      notes: ['上轮内部资料命中率较高，应优先复用。'],
      recommendedCandidateIds: [],
      autoConfirmCandidateIds: [],
      sourceSummary: {
        externalSourceCount: 1,
        internalSourceCount: 1,
        reusedMemoryCount: 1,
        reusedRuleCount: 1,
        reusedSkillCount: 1
      }
    };

    const builtContext = await (coordinator as any).buildConversationContext(session.id, '请继续刚才的研究');
    expect(builtContext).toContain('以下是上一轮任务留下的结构化上下文：');
    expect(builtContext).toContain('mem_internal_guideline');
    expect(builtContext).toContain('rule_safe_release');
    expect(builtContext).toContain('skill_release_check');
    expect(builtContext).toContain('React 官方文档对流式渲染的说明');
    expect(builtContext).toContain('learning 评估');
  });

  it('学习确认会把选中的候选写入 memory、rule 和 skill lab', async () => {
    const runtimeRepository = createRuntimeRepository();
    const orchestrator = createOrchestrator();
    const coordinator = new SessionCoordinator(
      orchestrator as never,
      runtimeRepository as never,
      createLlmProvider() as never
    );
    const session = await coordinator.createSession({ title: '学习确认', message: '请学习本轮经验' });

    await flushAsyncWork();

    const task = {
      id: 'task-1',
      status: TaskStatus.COMPLETED,
      learningCandidates: [
        {
          id: 'memory-1',
          taskId: 'task-1',
          type: 'memory',
          summary: 'memory',
          status: 'pending_confirmation',
          payload: { id: 'memory-record' },
          createdAt: '2026-03-22T00:00:00.000Z'
        },
        {
          id: 'rule-1',
          taskId: 'task-1',
          type: 'rule',
          summary: 'rule',
          status: 'pending_confirmation',
          payload: { id: 'rule-record' },
          createdAt: '2026-03-22T00:00:00.000Z'
        },
        {
          id: 'skill-1',
          taskId: 'task-1',
          type: 'skill',
          summary: 'skill',
          status: 'pending_confirmation',
          payload: { id: 'skill-record' },
          createdAt: '2026-03-22T00:00:00.000Z'
        }
      ]
    };
    orchestrator.getTask.mockReturnValue(task);

    const result = await coordinator.confirmLearning(session.id, {
      actor: 'tester',
      sessionId: session.id,
      candidateIds: ['memory-1', 'rule-1', 'skill-1']
    });

    expect(result.status).toBe('completed');
    expect(orchestrator.confirmLearning).toHaveBeenCalledWith('task-1', ['memory-1', 'rule-1', 'skill-1']);
    expect(coordinator.getEvents(session.id)).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: 'learning_confirmed' })])
    );
    expect(task.learningCandidates.every((candidate: any) => candidate.status === 'confirmed')).toBe(true);
  });

  it('审批通过和恢复会写入会话事件', async () => {
    const runtimeRepository = createRuntimeRepository();
    const orchestrator = createOrchestrator();
    const coordinator = new SessionCoordinator(
      orchestrator as never,
      runtimeRepository as never,
      createLlmProvider() as never
    );
    const session = await coordinator.createSession({ title: '审批恢复', message: '请执行高风险动作' });

    await flushAsyncWork();

    orchestrator.applyApproval.mockResolvedValue({
      id: 'task-1',
      sessionId: session.id,
      status: TaskStatus.COMPLETED,
      trace: [],
      approvals: [],
      agentStates: [],
      messages: [],
      currentStep: 'finish',
      retryCount: 0,
      maxRetries: 1,
      result: 'approved'
    });

    const approved = await coordinator.approve(session.id, {
      actor: 'tester',
      intent: ActionIntent.WRITE_FILE,
      sessionId: session.id
    });

    expect(approved.status).toBe('completed');
    expect(coordinator.getEvents(session.id)).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: 'approval_resolved' })])
    );

    const recovered = await coordinator.recover(session.id);
    expect(recovered.id).toBe(session.id);
    expect(coordinator.getEvents(session.id)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'session_started',
          payload: expect.objectContaining({ recovered: true })
        })
      ])
    );
  });
});
