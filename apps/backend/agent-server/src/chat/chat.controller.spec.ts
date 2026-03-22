import { describe, expect, it, vi } from 'vitest';

import { ChatController } from './chat.controller';

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
    subscribe: vi.fn(() => vi.fn())
  });

  const createRequest = () => ({ headers: {} });
  const createResponse = () => ({ cookie: vi.fn() });

  it('将查询接口委托给 ChatService', () => {
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

  it('在动作接口中优先使用 body/query 中的 sessionId，并写入 cookie', () => {
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
    controller.createSession({ title: '新会话', message: '你好' }, response as never);
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

  it('SSE 使用 query 中的 sessionId 订阅，并先回放历史事件', () => {
    const unsubscribe = vi.fn();
    const chatService = createChatService();
    const controller = new ChatController(chatService as never);
    const listener = vi.fn();
    let pushedListener: ((event: unknown) => void) | undefined;

    chatService.subscribe.mockImplementation((_id, next) => {
      pushedListener = next;
      return unsubscribe;
    });

    const subscription = controller.stream({ headers: {} } as never, 'session-1').subscribe({
      next: listener
    });

    expect(listener).toHaveBeenCalledWith({
      data: { sessionId: 'session-1', type: 'session_started' }
    });

    pushedListener?.({ sessionId: 'session-1', type: 'tool_called' });

    expect(listener).toHaveBeenCalledWith({
      data: { sessionId: 'session-1', type: 'tool_called' }
    });

    subscription.unsubscribe();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
