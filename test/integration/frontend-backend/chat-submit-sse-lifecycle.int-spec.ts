import { describe, expect, it, vi } from 'vitest';

import {
  ChatEventRecordSchema,
  type ChatEventRecord,
  type ChatMessageRecord,
  type ChatSessionRecord
} from '@agent/core';

import { ChatController } from '../../../apps/backend/agent-server/src/chat/chat.controller';
import {
  mergeEvent,
  syncMessageFromEvent,
  syncSessionFromEvent
} from '../../../apps/frontend/agent-chat/src/hooks/chat-session/chat-session-events';
import {
  shouldStopStreamingForEvent,
  syncCheckpointFromStreamEvent
} from '../../../apps/frontend/agent-chat/src/hooks/chat-session/chat-session-stream';

function createEvent(overrides: Partial<ChatEventRecord>): ChatEventRecord {
  return ChatEventRecordSchema.parse({
    id: overrides.id ?? `evt-${overrides.type ?? 'session_started'}`,
    sessionId: overrides.sessionId ?? 'session-lifecycle-1',
    type: overrides.type ?? 'session_started',
    at: overrides.at ?? '2026-04-23T00:00:00.000Z',
    payload: overrides.payload ?? { taskId: 'task-lifecycle-1' }
  });
}

function createSseResponse() {
  return {
    cookie: vi.fn(),
    setHeader: vi.fn(),
    flushHeaders: vi.fn(),
    flush: vi.fn(),
    write: vi.fn(),
    end: vi.fn()
  };
}

function createSseRequest() {
  return {
    headers: {},
    on: vi.fn()
  };
}

function parseWrittenSseEvents(write: ReturnType<typeof vi.fn>) {
  return write.mock.calls
    .map(([chunk]) => String(chunk))
    .filter(chunk => chunk.startsWith('data: '))
    .map(chunk => ChatEventRecordSchema.parse(JSON.parse(chunk.slice('data: '.length).trim())));
}

function createLifecycleHarness() {
  const listeners = new Set<(event: ChatEventRecord) => void>();
  const historicalEvents = [
    createEvent({ id: 'evt-session-started', type: 'session_started' }),
    createEvent({
      id: 'evt-user-message',
      type: 'user_message',
      at: '2026-04-23T00:00:01.000Z',
      payload: { taskId: 'task-lifecycle-1', messageId: 'user-1', content: '继续执行集成测试计划' }
    })
  ];
  const session: ChatSessionRecord = {
    id: 'session-lifecycle-1',
    title: 'SSE lifecycle',
    status: 'running',
    createdAt: '2026-04-23T00:00:00.000Z',
    updatedAt: '2026-04-23T00:00:00.000Z'
  };

  const chatService = {
    createSession: vi.fn(async () => session),
    listEvents: vi.fn(() => historicalEvents),
    subscribe: vi.fn((_sessionId: string, listener: (event: ChatEventRecord) => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    })
  };

  return {
    controller: new ChatController(chatService as never),
    emit: (event: ChatEventRecord) => {
      for (const listener of listeners) {
        listener(event);
      }
    }
  };
}

describe('chat submit SSE lifecycle integration', () => {
  it('streams backend lifecycle events into frontend session, message, and checkpoint state', () => {
    const { controller, emit } = createLifecycleHarness();
    const request = createSseRequest();
    const response = createSseResponse();

    controller.stream(request as never, response as never, 'session-lifecycle-1');

    for (const event of [
      createEvent({
        id: 'evt-token-a',
        type: 'assistant_token',
        at: '2026-04-23T00:00:02.000Z',
        payload: { taskId: 'task-lifecycle-1', messageId: 'assistant-1', content: '已' }
      }),
      createEvent({
        id: 'evt-token-b',
        type: 'assistant_token',
        at: '2026-04-23T00:00:03.000Z',
        payload: { taskId: 'task-lifecycle-1', messageId: 'assistant-1', content: '开始' }
      }),
      createEvent({
        id: 'evt-final-delta',
        type: 'final_response_delta',
        at: '2026-04-23T00:00:04.000Z',
        payload: { taskId: 'task-lifecycle-1', messageId: 'assistant-1', content: '已开始补齐集成测试。' }
      }),
      createEvent({
        id: 'evt-assistant-message',
        type: 'assistant_message',
        at: '2026-04-23T00:00:05.000Z',
        payload: { taskId: 'task-lifecycle-1', messageId: 'assistant-1', content: '已开始补齐集成测试。' }
      }),
      createEvent({
        id: 'evt-session-finished',
        type: 'session_finished',
        at: '2026-04-23T00:00:06.000Z',
        payload: { taskId: 'task-lifecycle-1' }
      })
    ]) {
      emit(event);
    }

    const events = parseWrittenSseEvents(response.write);
    expect(events.map(event => event.type)).toEqual([
      'session_started',
      'user_message',
      'assistant_token',
      'assistant_token',
      'final_response_delta',
      'assistant_message',
      'session_finished'
    ]);

    let sessions: ChatSessionRecord[] = [
      {
        id: 'session-lifecycle-1',
        title: 'SSE lifecycle',
        status: 'running',
        createdAt: '2026-04-23T00:00:00.000Z',
        updatedAt: '2026-04-23T00:00:00.000Z'
      }
    ];
    let messages: ChatMessageRecord[] = [];
    let mergedEvents: ChatEventRecord[] = [];
    let checkpoint = {
      sessionId: 'session-lifecycle-1',
      taskId: 'task-lifecycle-1',
      graphState: { status: 'running' },
      thinkState: { title: '执行中', content: '等待 SSE', loading: true, blink: true },
      updatedAt: '2026-04-23T00:00:00.000Z'
    };

    for (const event of events) {
      mergedEvents = mergeEvent(mergedEvents, event);
      sessions = syncSessionFromEvent(sessions as never, event as never) as ChatSessionRecord[];
      messages = syncMessageFromEvent(messages as never, event as never) as ChatMessageRecord[];
      checkpoint = syncCheckpointFromStreamEvent(checkpoint as never, event as never) as typeof checkpoint;
    }

    expect(mergedEvents).toHaveLength(events.length);
    expect(sessions[0].status).toBe('completed');
    expect(messages).toHaveLength(2);
    expect(messages.map(message => message.role)).toEqual(['user', 'assistant']);
    expect(messages.find(message => message.id === 'assistant-1')).toMatchObject({
      content: '已开始补齐集成测试。',
      taskId: 'task-lifecycle-1'
    });
    expect(shouldStopStreamingForEvent(events.at(-1)?.type ?? '')).toBe(true);
    expect(checkpoint).toMatchObject({
      graphState: { status: 'completed' },
      thinkState: { loading: false, blink: false }
    });

    const closeHandler = request.on.mock.calls.find(([eventName]) => eventName === 'close')?.[1];
    closeHandler?.();
    expect(response.end).toHaveBeenCalledTimes(1);
  });
});
