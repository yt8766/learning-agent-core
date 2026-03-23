import { describe, expect, it, vi } from 'vitest';

import { ChatService } from './chat.service';

describe('ChatService', () => {
  const createRuntimeService = () => ({
    listSessions: vi.fn(() => ['session-1']),
    createSession: vi.fn(dto => ({ id: 'session-1', ...dto })),
    getSession: vi.fn(sessionId => ({ id: sessionId })),
    listSessionMessages: vi.fn(sessionId => [{ sessionId, role: 'user', content: 'hello' }]),
    listSessionEvents: vi.fn(sessionId => [{ sessionId, type: 'user_message' }]),
    getSessionCheckpoint: vi.fn(sessionId => ({ sessionId, taskId: 'task-1' })),
    appendSessionMessage: vi.fn((sessionId, dto) => ({ sessionId, ...dto })),
    approveSessionAction: vi.fn((sessionId, dto) => ({ sessionId, action: 'approve', ...dto })),
    rejectSessionAction: vi.fn((sessionId, dto) => ({ sessionId, action: 'reject', ...dto })),
    confirmLearning: vi.fn((sessionId, dto) => ({ sessionId, ...dto })),
    recoverSession: vi.fn(sessionId => ({ sessionId, recovered: true })),
    subscribeSession: vi.fn(() => vi.fn())
  });

  it('将查询类方法委托给 RuntimeService', () => {
    const runtimeService = createRuntimeService();
    const service = new ChatService(runtimeService as never);

    expect(service.listSessions()).toEqual(['session-1']);
    expect(service.getSession('session-1')).toEqual({ id: 'session-1' });
    expect(service.listMessages('session-1')).toEqual([{ sessionId: 'session-1', role: 'user', content: 'hello' }]);
    expect(service.listEvents('session-1')).toEqual([{ sessionId: 'session-1', type: 'user_message' }]);
    expect(service.getCheckpoint('session-1')).toEqual({ sessionId: 'session-1', taskId: 'task-1' });

    expect(runtimeService.listSessions).toHaveBeenCalledTimes(1);
    expect(runtimeService.getSession).toHaveBeenCalledWith('session-1');
    expect(runtimeService.listSessionMessages).toHaveBeenCalledWith('session-1');
    expect(runtimeService.listSessionEvents).toHaveBeenCalledWith('session-1');
    expect(runtimeService.getSessionCheckpoint).toHaveBeenCalledWith('session-1');
  });

  it('将写操作方法委托给 RuntimeService', () => {
    const runtimeService = createRuntimeService();
    const service = new ChatService(runtimeService as never);

    expect(service.createSession({ title: '测试会话' })).toEqual({
      id: 'session-1',
      title: '测试会话'
    });
    expect(service.appendMessage('session-1', { content: '继续' })).toEqual({
      sessionId: 'session-1',
      content: '继续'
    });
    expect(service.approve('session-1', { actor: 'tester', approvalId: 'approval-1', sessionId: 'session-1' })).toEqual(
      {
        sessionId: 'session-1',
        action: 'approve',
        actor: 'tester',
        approvalId: 'approval-1'
      }
    );
    expect(service.reject('session-1', { actor: 'tester', approvalId: 'approval-1', sessionId: 'session-1' })).toEqual({
      sessionId: 'session-1',
      action: 'reject',
      actor: 'tester',
      approvalId: 'approval-1'
    });
    expect(
      service.confirmLearning('session-1', { actor: 'tester', candidateIds: ['memory-1'], sessionId: 'session-1' })
    ).toEqual({
      sessionId: 'session-1',
      actor: 'tester',
      candidateIds: ['memory-1']
    });
    expect(service.recover('session-1')).toEqual({ sessionId: 'session-1', recovered: true });

    expect(runtimeService.createSession).toHaveBeenCalledWith({ title: '测试会话' });
    expect(runtimeService.appendSessionMessage).toHaveBeenCalledWith('session-1', { content: '继续' });
    expect(runtimeService.approveSessionAction).toHaveBeenCalledWith('session-1', {
      actor: 'tester',
      approvalId: 'approval-1',
      sessionId: 'session-1'
    });
    expect(runtimeService.rejectSessionAction).toHaveBeenCalledWith('session-1', {
      actor: 'tester',
      approvalId: 'approval-1',
      sessionId: 'session-1'
    });
    expect(runtimeService.confirmLearning).toHaveBeenCalledWith('session-1', {
      actor: 'tester',
      candidateIds: ['memory-1'],
      sessionId: 'session-1'
    });
    expect(runtimeService.recoverSession).toHaveBeenCalledWith('session-1');
  });

  it('暴露订阅能力给 SSE 使用', () => {
    const unsubscribe = vi.fn();
    const runtimeService = createRuntimeService();
    runtimeService.subscribeSession.mockReturnValue(unsubscribe);
    const service = new ChatService(runtimeService as never);
    const listener = vi.fn();

    const result = service.subscribe('session-1', listener);

    expect(result).toBe(unsubscribe);
    expect(runtimeService.subscribeSession).toHaveBeenCalledWith('session-1', listener);
  });
});
