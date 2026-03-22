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

    return {
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

        listeners.forEach(listener => listener(task));
        return task;
      }),
      getTask: vi.fn(),
      applyApproval: vi.fn()
    };
  };

  it('创建会话后会写入初始消息、事件和 checkpoint', async () => {
    const runtimeRepository = createRuntimeRepository();
    const orchestrator = createOrchestrator();
    const coordinator = new SessionCoordinator(
      orchestrator as never,
      runtimeRepository as never,
      { append: vi.fn() } as never,
      { publishToLab: vi.fn() } as never
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

  it('订阅者可以收到新增事件', async () => {
    const runtimeRepository = createRuntimeRepository();
    const orchestrator = createOrchestrator();
    const coordinator = new SessionCoordinator(
      orchestrator as never,
      runtimeRepository as never,
      { append: vi.fn() } as never,
      { publishToLab: vi.fn() } as never
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
      { append: vi.fn() } as never,
      { publishToLab: vi.fn() } as never
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

    const compactedContext = (coordinator as any).buildConversationContext(session.id);
    expect(compactedContext).toContain('以下是较早聊天记录的压缩摘要：');
    expect(compactedContext).toContain('以下是最近的原始消息：');
  });

  it('学习确认会把选中的候选写入 memory、rule 和 skill lab', async () => {
    const runtimeRepository = createRuntimeRepository();
    const orchestrator = createOrchestrator();
    const memoryRepository = { append: vi.fn(async () => undefined) };
    const skillRegistry = { publishToLab: vi.fn(async () => undefined) };
    const coordinator = new SessionCoordinator(
      orchestrator as never,
      runtimeRepository as never,
      memoryRepository as never,
      skillRegistry as never
    );
    const ruleRepository = { append: vi.fn(async () => undefined) };
    (coordinator as any).ruleRepository = ruleRepository;
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
    expect(memoryRepository.append).toHaveBeenCalledWith({ id: 'memory-record' });
    expect(ruleRepository.append).toHaveBeenCalledWith({ id: 'rule-record' });
    expect(skillRegistry.publishToLab).toHaveBeenCalledWith({ id: 'skill-record' });
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
      { append: vi.fn() } as never,
      { publishToLab: vi.fn() } as never
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
