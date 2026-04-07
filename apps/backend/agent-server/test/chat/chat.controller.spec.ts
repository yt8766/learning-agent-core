import { describe, expect, it, vi } from 'vitest';

import { ChatController } from '../../src/chat/chat.controller';

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

describe('ChatController', () => {
  const createChatService = () => ({
    listSessions: vi.fn(() => ['session-1']),
    createSession: vi.fn(dto => ({ id: 'session-1', ...dto })),
    getSession: vi.fn(id => ({ id })),
    listMessages: vi.fn(id => [{ sessionId: id, role: 'user', content: 'hello' }]),
    listEvents: vi.fn(id => [{ sessionId: id, type: 'session_started' }]),
    getCheckpoint: vi.fn(id => ({ sessionId: id, taskId: 'task-1' })),
    appendMessage: vi.fn((id, dto) => ({ sessionId: id, ...dto })),
    approve: vi.fn((id, dto) => ({ sessionId: id, ...dto })),
    reject: vi.fn((id, dto) => ({ sessionId: id, ...dto })),
    confirmLearning: vi.fn((id, dto) => ({ sessionId: id, ...dto })),
    recover: vi.fn(id => ({ sessionId: id, recovered: true })),
    cancel: vi.fn((id, dto) => ({ sessionId: id, ...dto })),
    subscribe: vi.fn(() => vi.fn())
  });

  const createRequest = () => ({ headers: {} });
  const createResponse = () => ({ cookie: vi.fn() });

  it('delegates query endpoints to ChatService', () => {
    const chatService = createChatService();
    const controller = new ChatController(chatService as never);
    const request = createRequest();
    const response = createResponse();

    expect(controller.listSessions()).toEqual(['session-1']);
    expect(controller.getSession('session-1', response as never)).toEqual({ id: 'session-1' });
    expect(controller.listMessages(request as never, response as never, 'session-1')).toEqual([
      { sessionId: 'session-1', role: 'user', content: 'hello' }
    ]);
    expect(controller.listEvents(request as never, response as never, 'session-1')).toEqual([
      { sessionId: 'session-1', type: 'session_started' }
    ]);
    expect(controller.getCheckpoint(request as never, response as never, 'session-1')).toEqual({
      sessionId: 'session-1',
      taskId: 'task-1'
    });
  });

  it('prefers explicit sessionId in action endpoints and writes the cookie', () => {
    const chatService = createChatService();
    const controller = new ChatController(chatService as never);
    const request = createRequest();
    const response = createResponse();

    controller.approve(request as never, response as never, {
      actor: 'tester',
      intent: 'write_file',
      sessionId: 'session-1'
    });
    controller.reject(request as never, response as never, {
      actor: 'tester',
      intent: 'write_file',
      sessionId: 'session-1'
    });
    controller.confirmLearning(request as never, response as never, {
      actor: 'tester',
      candidateIds: ['candidate-1'],
      sessionId: 'session-1'
    });
    controller.appendMessage(request as never, response as never, { sessionId: 'session-1', message: '继续执行' });
    controller.createSession({ title: '新会话' }, response as never);
    controller.recover(request as never, response as never, { sessionId: 'session-1' });

    expect(chatService.approve).toHaveBeenCalledWith('session-1', {
      actor: 'tester',
      intent: 'write_file',
      sessionId: 'session-1'
    });
    expect(chatService.reject).toHaveBeenCalledWith('session-1', {
      actor: 'tester',
      intent: 'write_file',
      sessionId: 'session-1'
    });
    expect(chatService.confirmLearning).toHaveBeenCalledWith('session-1', {
      actor: 'tester',
      candidateIds: ['candidate-1'],
      sessionId: 'session-1'
    });
    expect(chatService.appendMessage).toHaveBeenCalledWith('session-1', { message: '继续执行' });
    expect(chatService.recover).toHaveBeenCalledWith('session-1');
    expect(response.cookie).toHaveBeenCalled();
  });

  it('replays historical non-token events and keeps realtime assistant_token events', () => {
    const unsubscribe = vi.fn();
    const chatService = createChatService();
    const controller = new ChatController(chatService as never);
    let pushedListener: ((event: unknown) => void) | undefined;
    const response = createSseResponse();
    const request = {
      headers: {},
      on: vi.fn()
    };

    chatService.listEvents.mockReturnValue([
      { sessionId: 'session-1', type: 'session_started' },
      {
        sessionId: 'session-1',
        type: 'assistant_token',
        payload: { messageId: 'msg-1', content: '你' }
      }
    ]);
    chatService.subscribe.mockImplementation((_id, next) => {
      pushedListener = next;
      return unsubscribe;
    });

    controller.stream(request as never, response as never, 'session-1');

    expect(response.write).toHaveBeenCalledWith(': stream-open\n\n');
    expect(response.write).toHaveBeenCalledWith(
      `data: ${JSON.stringify({ sessionId: 'session-1', type: 'session_started' })}\n\n`
    );
    expect(response.write).not.toHaveBeenCalledWith(
      `data: ${JSON.stringify({
        sessionId: 'session-1',
        type: 'assistant_token',
        payload: { messageId: 'msg-1', content: '你' }
      })}\n\n`
    );

    pushedListener?.({
      sessionId: 'session-1',
      type: 'assistant_token',
      payload: { messageId: 'msg-1', content: '好' }
    });

    expect(response.write).toHaveBeenCalledWith(
      `data: ${JSON.stringify({
        sessionId: 'session-1',
        type: 'assistant_token',
        payload: { messageId: 'msg-1', content: '好' }
      })}\n\n`
    );

    const closeHandler = request.on.mock.calls.find(call => call[0] === 'close')?.[1];
    closeHandler?.();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(response.end).toHaveBeenCalledTimes(1);
  });
});
