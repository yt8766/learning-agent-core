import { describe, expect, it, vi } from 'vitest';
import { TaskStatus } from '@agent/shared';

vi.mock('../src/adapters/llm/zhipu-provider', () => ({
  ZhipuLlmProvider: class {
    isConfigured() {
      return false;
    }

    async generateText() {
      return '';
    }
  }
}));

import { SessionCoordinator } from '../src/session/session-coordinator';
import {
  createLlmProvider,
  createOrchestrator,
  createRuntimeRepository,
  createStreamingOrchestrator,
  flushAsyncWork
} from './session-coordinator.test.utils';

describe('SessionCoordinator core flows', () => {
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

    expect(orchestrator.createTask).toHaveBeenCalledWith(
      expect.objectContaining({
        goal: '你好，Agent',
        context: expect.stringContaining('当前用户最新问题：\n你好，Agent'),
        recentTurns: [{ role: 'user', content: '你好，Agent' }],
        constraints: [],
        sessionId: session.id
      })
    );
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
        graphState: expect.objectContaining({ status: 'completed' })
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
    expect(createTaskArg.context).toContain('本轮按当前问题再次检索出的历史经验');
    expect(createTaskArg.context).toContain('构建前先做类型检查');
    expect(createTaskArg.context).toContain('发布前必须通过构建');
  });

  it('会保留不同轮次中内容相同的 assistant 最终回复', async () => {
    const runtimeRepository = createRuntimeRepository();
    const orchestrator = createStreamingOrchestrator();
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

  it('同一轮 summary 与 task.result 相同，只会落一条 assistant 最终回复', async () => {
    const runtimeRepository = createRuntimeRepository();
    const orchestrator = createOrchestrator();
    const coordinator = new SessionCoordinator(
      orchestrator as never,
      runtimeRepository as never,
      createLlmProvider() as never
    );

    const session = await coordinator.createSession({ title: '去重测试', message: '你好，Agent' });
    await flushAsyncWork();

    const assistantMessages = coordinator
      .getMessages(session.id)
      .filter(message => message.role === 'assistant' && message.content === 'Execution completed successfully.');

    expect(assistantMessages).toHaveLength(1);
  });

  it('空会话首条消息会自动把默认标题改成消息摘要', async () => {
    const runtimeRepository = createRuntimeRepository();
    const orchestrator = createOrchestrator();
    const coordinator = new SessionCoordinator(
      orchestrator as never,
      runtimeRepository as never,
      createLlmProvider() as never
    );

    const session = await coordinator.createSession({});
    expect(session.title).toBe('新会话');

    await coordinator.appendMessage(session.id, { message: '/browse 这个产品规划怎么样，后续还有什么优化空间' });

    expect(coordinator.getSession(session.id)?.title).toBe('这个产品规划怎么样，后续还有什么优化空间');
    expect(coordinator.getEvents(session.id)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'user_message',
          payload: expect.objectContaining({
            title: '这个产品规划怎么样，后续还有什么优化空间'
          })
        })
      ])
    );
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

  it('没有活动 taskId 时取消会话不会报错，并会优雅收口当前运行态', async () => {
    const runtimeRepository = createRuntimeRepository();
    const orchestrator = createOrchestrator();
    const coordinator = new SessionCoordinator(
      orchestrator as never,
      runtimeRepository as never,
      createLlmProvider() as never
    );

    const session = await coordinator.createSession({ title: '取消测试' });
    const storedSession = coordinator.getSession(session.id)!;
    storedSession.status = 'running';

    const cancelled = await coordinator.cancel(session.id, {
      actor: 'tester',
      sessionId: session.id,
      reason: '用户提前终止'
    });

    expect(cancelled.status).toBe('cancelled');
    expect(orchestrator.cancelTask).not.toHaveBeenCalled();
    expect(coordinator.getEvents(session.id)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'run_cancelled',
          payload: expect.objectContaining({
            summary: '执行已终止：用户提前终止'
          })
        })
      ])
    );
    expect(coordinator.getMessages(session.id)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: 'system',
          content: '已终止当前执行：用户提前终止'
        })
      ])
    );
  });

  it('刚开始运行就取消时，会在创建 task 前停止继续推进', async () => {
    const runtimeRepository = createRuntimeRepository();
    const listeners = new Set<(task: any) => void>();
    const orchestrator = {
      initialize: vi.fn(async () => undefined),
      subscribe: vi.fn((listener: (task: any) => void) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      }),
      subscribeTokens: vi.fn(() => () => true),
      createTask: vi.fn(async () => ({ id: 'task-race-1' })),
      getTask: vi.fn(() => undefined),
      ensureLearningCandidates: vi.fn(),
      confirmLearning: vi.fn(),
      applyApproval: vi.fn(),
      cancelTask: vi.fn(async (taskId: string, reason?: string) => {
        const cancelledTask = {
          id: taskId,
          sessionId: session.id,
          status: TaskStatus.CANCELLED,
          trace: [
            {
              node: 'run_cancelled',
              at: '2026-03-22T00:00:02.000Z',
              summary: reason ? `执行已终止：${reason}` : '执行已手动终止。'
            }
          ],
          approvals: [],
          agentStates: [],
          messages: [],
          result: reason ? `执行已终止：${reason}` : '执行已手动终止。',
          createdAt: '2026-03-22T00:00:00.000Z',
          updatedAt: '2026-03-22T00:00:02.000Z',
          currentStep: 'cancelled',
          retryCount: 0,
          maxRetries: 1
        };
        listeners.forEach(listener => listener(cancelledTask));
        return cancelledTask;
      })
    };
    const coordinator = new SessionCoordinator(
      orchestrator as never,
      runtimeRepository as never,
      createLlmProvider() as never
    );

    const session = await coordinator.createSession({ title: '竞态取消' });
    await coordinator.appendMessage(session.id, { message: '请开始执行' });

    await coordinator.cancel(session.id, {
      actor: 'tester',
      sessionId: session.id,
      reason: '用户提前终止'
    });

    await flushAsyncWork();

    expect(orchestrator.createTask).not.toHaveBeenCalled();
    expect(orchestrator.cancelTask).not.toHaveBeenCalled();
    expect(coordinator.getSession(session.id)?.status).toBe('cancelled');
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

    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ sessionId: session.id, type: 'user_message' }));

    unsubscribe();
    const callCount = listener.mock.calls.length;
    await coordinator.appendMessage(session.id, { message: '第三条消息' });
    expect(listener).toHaveBeenCalledTimes(callCount);
  });
});
