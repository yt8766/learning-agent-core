import { describe, expect, it, vi } from 'vitest';

import type { RuntimeSessionService } from '../../src/runtime/services/runtime-session.service';
import { ChatCapabilityIntentsService } from '../../src/chat/chat-capability-intents.service';
import { ChatService } from '../../src/chat/chat.service';

describe('ChatService', () => {
  const createRuntimeSessionService = () =>
    ({
      listSessions: vi.fn(() => ['session-1']),
      createSession: vi.fn(dto => ({ id: 'session-1', ...dto })),
      deleteSession: vi.fn(sessionId => ({ id: sessionId, deleted: true })),
      updateSession: vi.fn((sessionId, dto) => ({ id: sessionId, ...dto })),
      getSession: vi.fn(sessionId => ({ id: sessionId })),
      listSessionMessages: vi.fn(sessionId => [{ sessionId, role: 'user', content: 'hello' }]),
      listSessionEvents: vi.fn(sessionId => [{ sessionId, type: 'user_message' }]),
      getSessionCheckpoint: vi.fn(sessionId => ({ sessionId, taskId: 'task-1' })),
      appendSessionMessage: vi.fn((sessionId, dto) => ({ sessionId, ...dto })),
      approveSessionAction: vi.fn((sessionId, dto) => ({ sessionId, action: 'approve', ...dto })),
      rejectSessionAction: vi.fn((sessionId, dto) => ({ sessionId, action: 'reject', ...dto })),
      confirmLearning: vi.fn((sessionId, dto) => ({ sessionId, ...dto })),
      recoverSession: vi.fn(sessionId => ({ sessionId, recovered: true })),
      recoverSessionToCheckpoint: vi.fn(dto => ({ id: dto.sessionId, recovered: true })),
      cancelSession: vi.fn((sessionId, dto) => ({ sessionId, cancelled: true, ...dto })),
      subscribeSession: vi.fn(() => vi.fn())
    }) as unknown as RuntimeSessionService;

  const createCapabilityIntentService = () =>
    ({
      tryHandle: vi.fn(async () => undefined)
    }) as unknown as ChatCapabilityIntentsService;

  it('将查询类方法委托给 RuntimeSessionService', () => {
    const runtimeSessionService = createRuntimeSessionService();
    const capabilityIntentsService = createCapabilityIntentService();
    const service = new ChatService(runtimeSessionService, capabilityIntentsService);

    expect(service.listSessions()).toEqual(['session-1']);
    expect(service.getSession('session-1')).toEqual({ id: 'session-1' });
    expect(service.listMessages('session-1')).toEqual([{ sessionId: 'session-1', role: 'user', content: 'hello' }]);
    expect(service.listEvents('session-1')).toEqual([{ sessionId: 'session-1', type: 'user_message' }]);
    expect(service.getCheckpoint('session-1')).toEqual({ sessionId: 'session-1', taskId: 'task-1' });

    expect(runtimeSessionService.listSessions).toHaveBeenCalledTimes(1);
    expect(runtimeSessionService.getSession).toHaveBeenCalledWith('session-1');
    expect(runtimeSessionService.listSessionMessages).toHaveBeenCalledWith('session-1');
    expect(runtimeSessionService.listSessionEvents).toHaveBeenCalledWith('session-1');
    expect(runtimeSessionService.getSessionCheckpoint).toHaveBeenCalledWith('session-1');
  });

  it('将写操作方法委托给 RuntimeSessionService', () => {
    const runtimeSessionService = createRuntimeSessionService();
    const capabilityIntentsService = createCapabilityIntentService();
    const service = new ChatService(runtimeSessionService, capabilityIntentsService);

    expect(service.createSession({ title: '测试会话' })).toEqual({
      id: 'session-1',
      title: '测试会话'
    });
    return service.appendMessage('session-1', { message: '继续' }).then(result => {
      expect(result).toEqual({
        sessionId: 'session-1',
        message: '继续'
      });
      expect(runtimeSessionService.appendSessionMessage).toHaveBeenCalledWith('session-1', { message: '继续' });
    });
  });

  it('命中 capability intent 时优先返回内联响应', async () => {
    const runtimeSessionService = createRuntimeSessionService();
    const capabilityIntentsService = createCapabilityIntentService();
    const service = new ChatService(runtimeSessionService, capabilityIntentsService);
    (capabilityIntentsService.tryHandle as any).mockResolvedValue({
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

  it('继续校验其他写操作委托', () => {
    const runtimeSessionService = createRuntimeSessionService();
    const capabilityIntentsService = createCapabilityIntentService();
    const service = new ChatService(runtimeSessionService, capabilityIntentsService);

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

    expect(runtimeSessionService.approveSessionAction).toHaveBeenCalledWith('session-1', {
      actor: 'tester',
      approvalId: 'approval-1',
      sessionId: 'session-1'
    });
    expect(runtimeSessionService.rejectSessionAction).toHaveBeenCalledWith('session-1', {
      actor: 'tester',
      approvalId: 'approval-1',
      sessionId: 'session-1'
    });
    expect(runtimeSessionService.confirmLearning).toHaveBeenCalledWith('session-1', {
      actor: 'tester',
      candidateIds: ['memory-1'],
      sessionId: 'session-1'
    });
    expect(runtimeSessionService.recoverSession).toHaveBeenCalledWith('session-1');
    expect(runtimeSessionService.recoverSessionToCheckpoint).toHaveBeenCalledWith({
      sessionId: 'session-1',
      reason: 'test'
    });
    expect(runtimeSessionService.cancelSession).toHaveBeenCalledWith('session-1', {
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
    const listener = vi.fn();

    const result = service.subscribe('session-1', listener);

    expect(result).toBe(unsubscribe);
    expect(runtimeSessionService.subscribeSession).toHaveBeenCalledWith('session-1', listener);
  });
});
