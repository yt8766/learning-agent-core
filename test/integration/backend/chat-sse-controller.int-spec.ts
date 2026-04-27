import { describe, expect, it, vi } from 'vitest';

import { ChatEventRecordSchema, type ChatEventRecord, type ChatSessionRecord } from '@agent/core';

import { ChatController } from '../../../apps/backend/agent-server/src/chat/chat.controller';

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

function createEvent(overrides: Partial<ChatEventRecord> = {}): ChatEventRecord {
  return ChatEventRecordSchema.parse({
    id: overrides.id ?? 'evt-session-started',
    sessionId: overrides.sessionId ?? 'session-sse-1',
    type: overrides.type ?? 'session_started',
    at: overrides.at ?? '2026-04-23T00:00:00.000Z',
    payload: overrides.payload ?? { taskId: 'task-sse-1' }
  });
}

function createControllerHarness() {
  const historicalEvents = [
    createEvent({ id: 'evt-started', type: 'session_started' }),
    createEvent({
      id: 'evt-old-token',
      type: 'assistant_token',
      payload: { taskId: 'task-sse-1', messageId: 'assistant-1', content: '旧' }
    }),
    createEvent({
      id: 'evt-finished',
      type: 'session_finished',
      at: '2026-04-23T00:00:01.000Z'
    })
  ];
  const listeners = new Set<(event: ChatEventRecord) => void>();
  const session: ChatSessionRecord = {
    id: 'session-sse-1',
    title: 'SSE contract session',
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
  const controller = new ChatController(chatService as never);

  return {
    controller,
    chatService,
    emit: (event: ChatEventRecord) => {
      for (const listener of listeners) {
        listener(event);
      }
    }
  };
}

function parseWrittenSseEvents(write: ReturnType<typeof vi.fn>) {
  return write.mock.calls
    .map(([chunk]) => String(chunk))
    .filter(chunk => chunk.startsWith('data: '))
    .map(chunk => JSON.parse(chunk.slice('data: '.length).trim()) as ChatEventRecord);
}

describe('backend chat SSE controller integration', () => {
  it('creates sessions through the backend controller with a stable session contract', async () => {
    const { controller } = createControllerHarness();
    const response = { cookie: vi.fn() };

    const session = await controller.createSession({ title: 'SSE contract session' }, response as never);

    expect(session).toMatchObject({
      id: 'session-sse-1',
      title: 'SSE contract session',
      status: 'running'
    });
    expect(response.cookie).toHaveBeenCalledWith('agent_session_id', 'session-sse-1', {
      httpOnly: false,
      sameSite: 'lax',
      path: '/'
    });
  });

  it('streams parseable historical events, filters stale assistant tokens, and delivers live tokens', () => {
    const { controller, emit } = createControllerHarness();
    const request = createSseRequest();
    const response = createSseResponse();

    controller.stream(request as never, response as never, 'session-sse-1');

    expect(response.setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream');
    expect(response.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-cache, no-transform');
    expect(response.setHeader).toHaveBeenCalledWith('Connection', 'keep-alive');
    expect(response.setHeader).toHaveBeenCalledWith('X-Accel-Buffering', 'no');
    expect(response.write).toHaveBeenCalledWith(': stream-open\n\n');
    expect(response.write).not.toHaveBeenCalledWith(expect.stringContaining('"id":"evt-old-token"'));

    const liveToken = createEvent({
      id: 'evt-live-token',
      type: 'assistant_token',
      at: '2026-04-23T00:00:02.000Z',
      payload: { taskId: 'task-sse-1', messageId: 'assistant-1', content: '新' }
    });
    emit(liveToken);

    const events = parseWrittenSseEvents(response.write);
    expect(events.map(event => event.id)).toEqual(['evt-started', 'evt-finished', 'evt-live-token']);
    for (const event of events) {
      expect(() => ChatEventRecordSchema.parse(event)).not.toThrow();
    }

    const closeHandler = request.on.mock.calls.find(([eventName]) => eventName === 'close')?.[1];
    closeHandler?.();
    expect(response.end).toHaveBeenCalledTimes(1);
  });

  it('uses the explicit stream session id over cookies and stops delivery after client close', () => {
    const { controller, chatService, emit } = createControllerHarness();
    const request = {
      ...createSseRequest(),
      headers: { cookie: 'agent_session_id=session-from-cookie' }
    };
    const response = createSseResponse();

    controller.stream(request as never, response as never, 'session-sse-1');

    expect(response.cookie).toHaveBeenCalledWith('agent_session_id', 'session-sse-1', {
      httpOnly: false,
      sameSite: 'lax',
      path: '/'
    });
    expect(chatService.listEvents).toHaveBeenCalledWith('session-sse-1');
    expect(chatService.subscribe).toHaveBeenCalledWith('session-sse-1', expect.any(Function));

    const writeCountBeforeClose = response.write.mock.calls.length;
    const closeHandler = request.on.mock.calls.find(([eventName]) => eventName === 'close')?.[1];
    closeHandler?.();

    emit(
      createEvent({
        id: 'evt-after-close',
        type: 'assistant_token',
        at: '2026-04-23T00:00:03.000Z',
        payload: { taskId: 'task-sse-1', messageId: 'assistant-1', content: 'close 后不应发送' }
      })
    );

    expect(response.write).toHaveBeenCalledTimes(writeCountBeforeClose);
    expect(response.end).toHaveBeenCalledTimes(1);
  });

  it('falls back to the session cookie for stream recovery and rejects requests without a session id', () => {
    const { controller, chatService } = createControllerHarness();
    const cookieRequest = {
      ...createSseRequest(),
      headers: { cookie: 'other=value; agent_session_id=session-sse-1' }
    };
    const response = createSseResponse();

    controller.stream(cookieRequest as never, response as never);

    expect(chatService.listEvents).toHaveBeenCalledWith('session-sse-1');
    expect(response.cookie).toHaveBeenCalledWith('agent_session_id', 'session-sse-1', {
      httpOnly: false,
      sameSite: 'lax',
      path: '/'
    });

    const closeHandler = cookieRequest.on.mock.calls.find(([eventName]) => eventName === 'close')?.[1];
    closeHandler?.();

    expect(() => controller.stream(createSseRequest() as never, createSseResponse() as never)).toThrow(
      'sessionId is required.'
    );
  });
});
