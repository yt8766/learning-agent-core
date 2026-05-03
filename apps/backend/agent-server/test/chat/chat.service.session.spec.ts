import { describe, expect, it, vi } from 'vitest';
import type { ChatMessageRecord } from '@agent/core';

import { ChatService } from '../../src/chat/chat.service';
import { dedupeSessionMessages } from '../../src/runtime/domain/session/runtime-session-message-dedupe';
import {
  createCapabilityIntentService,
  createRuntimeHost,
  createRuntimeSessionService
} from './chat.service.test-helpers';

describe('ChatService', () => {
  it('将查询类方法委托给 RuntimeSessionService', () => {
    const runtimeSessionService = createRuntimeSessionService();
    const capabilityIntentsService = createCapabilityIntentService();
    const service = new ChatService(runtimeSessionService, capabilityIntentsService);

    expect(service.listSessions()).toEqual(['session-1']);
    expect(service.getSession('session-1')).toEqual({ id: 'session-1' });
    expect(service.listMessages('session-1')).toEqual([{ sessionId: 'session-1', role: 'user', content: 'hello' }]);
    expect(service.listEvents('session-1')).toEqual([{ sessionId: 'session-1', type: 'user_message' }]);
    expect(service.getCheckpoint('session-1')).toEqual({ sessionId: 'session-1', taskId: 'task-1' });
  });

  it('将写操作方法委托给 RuntimeSessionService', () => {
    const runtimeSessionService = createRuntimeSessionService();
    const capabilityIntentsService = createCapabilityIntentService();
    const service = new ChatService(runtimeSessionService, capabilityIntentsService);

    expect(service.createSession({ title: '测试会话' })).toEqual({ id: 'session-1', title: '测试会话' });
    return service.appendMessage('session-1', { message: '继续' }).then(result => {
      expect(result).toEqual({ sessionId: 'session-1', message: '继续' });
      expect(runtimeSessionService.appendSessionMessage).toHaveBeenCalledWith('session-1', { message: '继续' });
    });
  });

  it('命中 capability intent 时优先返回内联响应', async () => {
    const runtimeSessionService = createRuntimeSessionService();
    const capabilityIntentsService = createCapabilityIntentService();
    const service = new ChatService(runtimeSessionService, capabilityIntentsService);
    (capabilityIntentsService.tryHandle as never as ReturnType<typeof vi.fn>).mockResolvedValue({
      sessionId: 'session-1',
      role: 'assistant',
      content: '已创建 skill'
    });

    await expect(service.appendMessage('session-1', { message: '帮我创建一个 skill' })).resolves.toEqual({
      sessionId: 'session-1',
      role: 'assistant',
      content: '已创建 skill'
    });
    expect(runtimeSessionService.appendSessionMessage).not.toHaveBeenCalled();
  });

  it('saves assistant message feedback and overwrites the current state', async () => {
    const assistantMessage = {
      id: 'assistant-1',
      sessionId: 'session-1',
      role: 'assistant',
      content: '可以这样做',
      createdAt: '2026-05-03T00:00:00.000Z'
    };
    const runtimeSessionService = createRuntimeSessionService();
    attachRuntimeMessages(runtimeSessionService, [assistantMessage]);
    const service = new ChatService(runtimeSessionService, createCapabilityIntentService());

    const updated = await service.submitMessageFeedback('assistant-1', {
      sessionId: 'session-1',
      rating: 'unhelpful',
      reasonCode: 'missed_point',
      comment: '漏了约束'
    });

    expect(updated).toMatchObject({
      id: 'assistant-1',
      feedback: {
        messageId: 'assistant-1',
        sessionId: 'session-1',
        rating: 'unhelpful',
        reasonCode: 'missed_point',
        comment: '漏了约束',
        updatedAt: expect.any(String)
      }
    });

    const overwritten = await service.submitMessageFeedback('assistant-1', {
      sessionId: 'session-1',
      rating: 'helpful'
    });

    expect(overwritten).toMatchObject({
      id: 'assistant-1',
      feedback: {
        messageId: 'assistant-1',
        sessionId: 'session-1',
        rating: 'helpful',
        updatedAt: expect.any(String)
      }
    });
    expect((overwritten as { feedback?: { reasonCode?: string } }).feedback?.reasonCode).toBeUndefined();
  });

  it('clears assistant message feedback when rating is none', async () => {
    const assistantMessage = {
      id: 'assistant-1',
      sessionId: 'session-1',
      role: 'assistant',
      content: '可以这样做',
      createdAt: '2026-05-03T00:00:00.000Z',
      feedback: {
        rating: 'helpful',
        updatedAt: '2026-05-03T00:00:00.000Z'
      }
    };
    const runtimeSessionService = createRuntimeSessionService();
    attachRuntimeMessages(runtimeSessionService, [assistantMessage]);
    const service = new ChatService(runtimeSessionService, createCapabilityIntentService());

    const updated = await service.submitMessageFeedback('assistant-1', {
      sessionId: 'session-1',
      rating: 'none'
    });

    expect(updated).toMatchObject({ id: 'assistant-1' });
    expect((updated as { feedback?: unknown }).feedback).toBeUndefined();
  });

  it('rejects feedback for non-assistant messages', async () => {
    const runtimeSessionService = createRuntimeSessionService();
    attachRuntimeMessages(runtimeSessionService, [
      {
        id: 'user-1',
        sessionId: 'session-1',
        role: 'user',
        content: 'hello',
        createdAt: '2026-05-03T00:00:00.000Z'
      }
    ]) as never;
    const service = new ChatService(runtimeSessionService, createCapabilityIntentService());

    await expect(
      service.submitMessageFeedback('user-1', {
        sessionId: 'session-1',
        rating: 'helpful'
      })
    ).rejects.toThrow('Feedback can only be submitted for assistant messages');
  });

  it('rejects feedback when the session does not exist', async () => {
    const runtimeSessionService = createRuntimeSessionService();
    runtimeSessionService.getSession = vi.fn(() => {
      throw new Error('Session missing-session not found');
    }) as never;
    const service = new ChatService(runtimeSessionService, createCapabilityIntentService());

    await expect(
      service.submitMessageFeedback('assistant-1', {
        sessionId: 'missing-session',
        rating: 'helpful'
      })
    ).rejects.toThrow('Session missing-session not found');
  });

  it('rejects feedback when the message does not exist', async () => {
    const runtimeSessionService = createRuntimeSessionService();
    attachRuntimeMessages(runtimeSessionService, []);
    const service = new ChatService(runtimeSessionService, createCapabilityIntentService());

    await expect(
      service.submitMessageFeedback('missing-message', {
        sessionId: 'session-1',
        rating: 'helpful'
      })
    ).rejects.toThrow('Message missing-message not found');
  });

  it('rejects feedback when the message does not belong to the requested session', async () => {
    const runtimeSessionService = createRuntimeSessionService();
    attachRuntimeMessages(runtimeSessionService, [
      {
        id: 'assistant-1',
        sessionId: 'session-2',
        role: 'assistant',
        content: 'other session',
        createdAt: '2026-05-03T00:00:00.000Z'
      }
    ]) as never;
    const service = new ChatService(runtimeSessionService, createCapabilityIntentService());

    await expect(
      service.submitMessageFeedback('assistant-1', {
        sessionId: 'session-1',
        rating: 'helpful'
      })
    ).rejects.toThrow('does not belong to session');
  });

  it('persists feedback on the original assistant message when list messages returns a deduped copy', async () => {
    const transientAssistantMessage = {
      id: 'direct_reply_task-1',
      sessionId: 'session-1',
      role: 'assistant',
      content: '完成了',
      taskId: 'task-1',
      createdAt: '2026-05-03T00:00:00.000Z'
    };
    const finalAssistantMessage = {
      id: 'assistant-final-1',
      sessionId: 'session-1',
      role: 'assistant',
      content: '完成了',
      taskId: 'task-1',
      createdAt: '2026-05-03T00:00:01.000Z'
    };
    const originalMessages = [transientAssistantMessage, finalAssistantMessage];
    const runtimeSessionService = createRuntimeSessionService();
    attachRuntimeMessages(runtimeSessionService, originalMessages);
    const service = new ChatService(runtimeSessionService, createCapabilityIntentService());

    await service.submitMessageFeedback('assistant-final-1', {
      sessionId: 'session-1',
      rating: 'helpful'
    });

    expect(finalAssistantMessage).toMatchObject({
      feedback: {
        messageId: 'assistant-final-1',
        sessionId: 'session-1',
        rating: 'helpful',
        updatedAt: expect.any(String)
      }
    });
    expect(service.listMessages('session-1')).toEqual([
      expect.objectContaining({
        id: 'assistant-final-1',
        feedback: expect.objectContaining({
          messageId: 'assistant-final-1',
          rating: 'helpful'
        })
      })
    ]);
  });

  it('emits a learning candidate event for actionable unhelpful feedback', async () => {
    const assistantMessage = {
      id: 'assistant-1',
      sessionId: 'session-1',
      role: 'assistant',
      content: '镜像是模板，容器是实例。',
      createdAt: '2026-05-03T00:00:00.000Z'
    };
    const runtimeSessionService = createRuntimeSessionService();
    attachRuntimeMessages(runtimeSessionService, [assistantMessage]);
    const service = new ChatService(runtimeSessionService, createCapabilityIntentService());

    await service.submitMessageFeedback('assistant-1', {
      sessionId: 'session-1',
      rating: 'unhelpful',
      reasonCode: 'too_shallow'
    });

    expect(service.listEvents('session-1')).toEqual([
      expect.objectContaining({
        type: 'message_feedback_learning_candidate',
        payload: expect.objectContaining({
          messageId: 'assistant-1',
          rating: 'unhelpful',
          reasonCode: 'too_shallow',
          source: 'message_feedback',
          candidateText: expect.stringContaining('核心结论')
        })
      })
    ]);
  });

  it('does not emit learning candidates for factual-correction feedback', async () => {
    const assistantMessage = {
      id: 'assistant-1',
      sessionId: 'session-1',
      role: 'assistant',
      content: '镜像和容器完全相同。',
      createdAt: '2026-05-03T00:00:00.000Z'
    };
    const runtimeSessionService = createRuntimeSessionService();
    attachRuntimeMessages(runtimeSessionService, [assistantMessage]);
    const service = new ChatService(runtimeSessionService, createCapabilityIntentService());

    await service.submitMessageFeedback('assistant-1', {
      sessionId: 'session-1',
      rating: 'unhelpful',
      reasonCode: 'incorrect',
      comment: '这句不准确'
    });

    expect(service.listEvents('session-1')).toEqual([]);
  });

  it('uses the comment as the learning candidate for other unhelpful feedback', async () => {
    const assistantMessage = {
      id: 'assistant-1',
      sessionId: 'session-1',
      role: 'assistant',
      content: '回答内容',
      createdAt: '2026-05-03T00:00:00.000Z'
    };
    const runtimeSessionService = createRuntimeSessionService();
    attachRuntimeMessages(runtimeSessionService, [assistantMessage]);
    const service = new ChatService(runtimeSessionService, createCapabilityIntentService());

    await service.submitMessageFeedback('assistant-1', {
      sessionId: 'session-1',
      rating: 'unhelpful',
      reasonCode: 'other',
      comment: '以后先解释为什么，再给命令'
    });

    expect(service.listEvents('session-1')).toEqual([
      expect.objectContaining({
        type: 'message_feedback_learning_candidate',
        payload: expect.objectContaining({
          candidateText: '以后先解释为什么，再给命令'
        })
      })
    ]);
  });

  it('继续校验其他写操作委托', () => {
    const runtimeSessionService = createRuntimeSessionService();
    const capabilityIntentsService = createCapabilityIntentService();
    const service = new ChatService(runtimeSessionService, capabilityIntentsService);

    expect(service.approve('session-1', { actor: 'tester', approvalId: 'approval-1', sessionId: 'session-1' })).toEqual(
      { sessionId: 'session-1', action: 'approve', actor: 'tester', approvalId: 'approval-1' }
    );
    expect(service.reject('session-1', { actor: 'tester', approvalId: 'approval-1', sessionId: 'session-1' })).toEqual({
      sessionId: 'session-1',
      action: 'reject',
      actor: 'tester',
      approvalId: 'approval-1'
    });
    expect(
      service.confirmLearning('session-1', { actor: 'tester', candidateIds: ['memory-1'], sessionId: 'session-1' })
    ).toEqual({ sessionId: 'session-1', actor: 'tester', candidateIds: ['memory-1'] });
    expect(service.recover('session-1')).toEqual({ sessionId: 'session-1', recovered: true });
    expect(service.recoverToCheckpoint({ sessionId: 'session-1', reason: 'test' })).toEqual({
      id: 'session-1',
      recovered: true
    });
    expect(service.cancel('session-1', { actor: 'tester', reason: 'stop' })).toEqual({
      sessionId: 'session-1',
      cancelled: true,
      actor: 'tester',
      reason: 'stop'
    });
  });

  it('暴露订阅能力给 SSE 使用', () => {
    const unsubscribe = vi.fn();
    const runtimeSessionService = createRuntimeSessionService();
    runtimeSessionService.subscribeSession = vi.fn(() => unsubscribe) as never;
    const capabilityIntentsService = createCapabilityIntentService();
    const service = new ChatService(runtimeSessionService, capabilityIntentsService);

    expect(service.subscribe('session-1', vi.fn())).toBe(unsubscribe);
  });

  it('streams direct model output for the SSE chat endpoint', async () => {
    const runtimeHost = createRuntimeHost();
    const push = vi.fn();
    const chatService = new ChatService(createRuntimeSessionService(), createCapabilityIntentService(), runtimeHost);

    const result = await chatService.streamChat(
      {
        message: '你好',
        systemPrompt: '你是一个助手',
        modelId: 'glm-4.5',
        temperature: 0.6,
        maxTokens: 256
      },
      push
    );

    expect(push).toHaveBeenNthCalledWith(1, { type: 'token', data: { content: '你' } });
    expect(push).toHaveBeenNthCalledWith(2, { type: 'token', data: { content: '好' } });
    expect(result).toEqual({ content: '你好' });
    expect(runtimeHost.modelInvocationFacade.invoke).toHaveBeenCalledWith(
      expect.objectContaining({
        modeProfile: 'direct-reply',
        stage: 'direct_reply',
        requestedModelId: 'glm-4.5',
        contextHints: expect.objectContaining({
          temperature: 0.6,
          maxTokens: 256,
          thinking: false,
          onToken: expect.any(Function)
        }),
        budgetSnapshot: expect.objectContaining({
          costBudgetUsd: 5,
          fallbackModelId: 'glm-5.1'
        }),
        messages: expect.arrayContaining([
          expect.objectContaining({ role: 'system', content: expect.stringContaining('不要启动任务编排') }),
          { role: 'system', content: '你是一个助手' },
          { role: 'user', content: '你好' }
        ])
      })
    );
    expect(runtimeHost.llmProvider.streamText).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ role: 'system', content: expect.stringContaining('不要启动任务编排') }),
        { role: 'user', content: '你好' }
      ]),
      expect.objectContaining({
        role: 'manager',
        modelId: 'glm-4.5',
        temperature: 0.6,
        maxTokens: 256,
        thinking: false,
        budgetState: {
          costConsumedUsd: undefined,
          costBudgetUsd: 5,
          fallbackModelId: 'glm-5.1'
        }
      }),
      expect.any(Function)
    );
  });

  it('retries direct model output when the first attempt fails with a retryable format error', async () => {
    const runtimeHost = createRuntimeHost();
    const invoke = vi
      .fn()
      .mockRejectedValueOnce(new Error('invalid json shape'))
      .mockResolvedValueOnce({
        finalOutput: {
          kind: 'text',
          text: '修复'
        },
        invocationRecordId: 'invoke-direct-reply-retry',
        traceSummary: {},
        deliveryMeta: {}
      });

    runtimeHost.modelInvocationFacade.invoke = invoke;
    const service = new ChatService(createRuntimeSessionService(), createCapabilityIntentService(), runtimeHost);

    await expect(service.streamChat({ message: '你好' }, vi.fn())).resolves.toEqual({ content: '修复' });
    expect(invoke).toHaveBeenCalledTimes(2);
    expect(invoke).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: 'user',
            content: expect.stringContaining('invalid json shape')
          })
        ])
      })
    );
  });

  it('detects data-report direct requests and resolves explicit direct response modes', async () => {
    const service = new ChatService(
      createRuntimeSessionService(),
      createCapabilityIntentService(),
      createRuntimeHost()
    );

    expect(service.resolveDirectResponseMode({ message: '参考 bonusCenterData 生成多个数据报表页面' })).toBe(
      'sandpack'
    );
    expect(service.resolveDirectResponseMode({ message: '生成一个后台页面', responseFormat: 'sandpack' })).toBe(
      'sandpack'
    );
    expect(service.resolveDirectResponseMode({ message: '生成一个后台页面', responseFormat: 'preview' })).toBe(
      'preview'
    );
    expect(
      service.resolveDirectResponseMode({ message: '生成 Bonus Center 报表 JSON', responseFormat: 'report-schema' })
    ).toBe('report-schema');
  });

  it('can still return explicit sandpack preview files without calling the LLM', async () => {
    const runtimeHost = createRuntimeHost();
    const service = new ChatService(createRuntimeSessionService(), createCapabilityIntentService(), runtimeHost);

    const sandpackFiles = await service.generateSandpackPreview({
      message: '参考 bonusCenterData 生成多个数据报表页面',
      responseFormat: 'preview'
    });

    expect(sandpackFiles).toHaveProperty('/App.tsx');
    expect(sandpackFiles).toHaveProperty('/src/pages/dataDashboard/bonusCenterData/index.tsx');
    expect((runtimeHost.llmProvider as unknown as LlmProvider).streamText).not.toHaveBeenCalled();
    expect(runtimeHost.modelInvocationFacade.invoke).not.toHaveBeenCalled();
  });
});

function attachRuntimeMessages(
  runtimeSessionService: ReturnType<typeof createRuntimeSessionService>,
  messages: ChatMessageRecord[]
) {
  const events: Array<{
    id: string;
    sessionId: string;
    type: string;
    at: string;
    payload: Record<string, unknown>;
  }> = [];
  const sessions = Array.from(new Set(['session-1', ...messages.map(message => message.sessionId)])).map(id => ({
    id
  }));
  runtimeSessionService.listSessions = vi.fn(() => sessions) as never;
  runtimeSessionService.listSessionMessages = vi.fn((sessionId: string) =>
    dedupeSessionMessages(messages.filter(message => message.sessionId === sessionId))
  ) as never;
  runtimeSessionService.listSessionEvents = vi.fn((sessionId: string) =>
    events.filter(event => event.sessionId === sessionId)
  ) as never;
  (runtimeSessionService as unknown as { getContext: () => unknown }).getContext = () => ({
    sessionCoordinator: {
      getMessages: (sessionId: string) => messages.filter(message => message.sessionId === sessionId),
      store: {
        addEvent: (sessionId: string, type: string, payload: Record<string, unknown>) => {
          const event = {
            id: `event-${events.length + 1}`,
            sessionId,
            type,
            at: '2026-05-03T00:00:00.000Z',
            payload
          };
          events.push(event);
          return event;
        },
        persistRuntimeState: vi.fn(async () => undefined)
      }
    }
  });
}
