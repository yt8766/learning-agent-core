import { describe, expect, it, vi } from 'vitest';

import type { ChatEventRecord } from '@agent/core';

import { ChatService } from '../../src/chat/chat.service';

describe('ChatService response step turn boundaries', () => {
  it('does not attach process events after a new user message to the previous assistant reply', () => {
    const service = createChatServiceWithEvents([
      {
        id: 'event-token-1',
        sessionId: 'session-1',
        type: 'assistant_token',
        at: '2026-05-02T08:29:59.000Z',
        payload: { messageId: 'assistant-1', content: '上一轮' }
      },
      {
        id: 'event-tool-1',
        sessionId: 'session-1',
        type: 'tool_called',
        at: '2026-05-02T08:30:00.000Z',
        payload: {
          title: 'Read first file',
          path: 'apps/frontend/agent-chat/src/pages/chat/chat-message-adapter.tsx'
        }
      },
      {
        id: 'event-user-2',
        sessionId: 'session-1',
        type: 'user_message',
        at: '2026-05-02T08:31:00.000Z',
        payload: { messageId: 'user-2', content: '下一轮' }
      },
      {
        id: 'event-tool-2',
        sessionId: 'session-1',
        type: 'execution_step_started',
        at: '2026-05-02T08:31:01.000Z',
        payload: {
          title: 'Should wait for next assistant owner',
          command: 'pnpm test'
        }
      },
      {
        id: 'event-token-2',
        sessionId: 'session-1',
        type: 'assistant_token',
        at: '2026-05-02T08:31:02.000Z',
        payload: { messageId: 'assistant-2', content: '新一轮' }
      },
      {
        id: 'event-tool-3',
        sessionId: 'session-1',
        type: 'execution_step_started',
        at: '2026-05-02T08:31:03.000Z',
        payload: {
          title: 'Runs after assistant owner',
          command: 'pnpm test'
        }
      }
    ] as ChatEventRecord[]);

    const events = service.listEvents('session-1');

    expect(events.find(event => event.id === 'response-step-event-event-tool-2')).toBeUndefined();
    expect(events.find(event => event.id === 'response-step-event-event-tool-3')?.payload).toEqual(
      expect.objectContaining({
        projection: 'chat_response_step',
        step: expect.objectContaining({
          messageId: 'assistant-2',
          title: 'Runs after assistant owner'
        })
      })
    );
  });
});

function createChatServiceWithEvents(events: ChatEventRecord[]) {
  return new ChatService(
    {
      listSessionEvents: vi.fn(() => events),
      subscribeSession: vi.fn()
    } as never,
    {} as never,
    {} as never
  );
}
