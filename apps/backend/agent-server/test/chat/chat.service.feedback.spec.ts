import { describe, expect, it, vi } from 'vitest';
import type { ChatMessageRecord } from '@agent/core';

import { ChatService } from '../../src/chat/chat.service';
import { dedupeSessionMessages } from '../../src/runtime/domain/session/runtime-session-message-dedupe';
import { createCapabilityIntentService, createRuntimeSessionService } from './chat.service.test-helpers';

describe('ChatService message feedback', () => {
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
