import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { RuntimeSessionService } from '../../../src/runtime/services/runtime-session.service';

describe('RuntimeSessionService', () => {
  const createService = () => {
    const unsubscribe = vi.fn();
    const sessionCoordinator = {
      listSessions: vi.fn(() => [{ id: 'session-1' }]),
      createSession: vi.fn(async (dto: any) => ({ id: 'session-1', ...dto })),
      deleteSession: vi.fn(async () => undefined),
      updateSession: vi.fn(async (id: string, dto: any) => ({ id, ...dto })),
      getSession: vi.fn((id: string) => (id === 'session-1' ? { id } : undefined)),
      getMessages: vi.fn(() => [{ id: 'msg-1' }]),
      getEvents: vi.fn(() => [{ id: 'event-1' }]),
      getCheckpoint: vi.fn(() => ({ sessionId: 'session-1', taskId: 'task-1' })),
      appendMessage: vi.fn(async (id: string, dto: any) => ({ sessionId: id, ...dto })),
      approve: vi.fn(async (id: string, dto: any) => ({ id, ...dto })),
      reject: vi.fn(async (id: string, dto: any) => ({ id, ...dto })),
      confirmLearning: vi.fn(async (id: string, dto: any) => ({ id, ...dto })),
      recover: vi.fn(async (id: string) => ({ id, recovered: true })),
      recoverToCheckpoint: vi.fn(async (_id: string, dto: any) => ({ id: dto.sessionId, recovered: true })),
      cancel: vi.fn(async (id: string, dto: any) => ({ id, ...dto })),
      subscribe: vi.fn(() => unsubscribe)
    };

    return {
      service: new RuntimeSessionService(() => ({ sessionCoordinator })),
      sessionCoordinator,
      unsubscribe
    };
  };

  it('委托会话读写、恢复与订阅能力', async () => {
    const { service, sessionCoordinator, unsubscribe } = createService();
    const listener = vi.fn();

    expect(service.listSessions()).toEqual([{ id: 'session-1' }]);
    expect(await service.createSession({ title: '测试会话' })).toEqual({ id: 'session-1', title: '测试会话' });
    await service.deleteSession('session-1');
    expect(await service.updateSession('session-1', { title: '新的标题' })).toEqual({
      id: 'session-1',
      title: '新的标题'
    });
    expect(service.getSession('session-1')).toEqual({ id: 'session-1' });
    expect(service.listSessionMessages('session-1')).toEqual([{ id: 'msg-1' }]);
    expect(service.listSessionEvents('session-1')).toEqual([{ id: 'event-1' }]);
    expect(service.getSessionCheckpoint('session-1')).toEqual({ sessionId: 'session-1', taskId: 'task-1' });
    expect(await service.appendSessionMessage('session-1', { message: '继续' })).toEqual({
      sessionId: 'session-1',
      message: '继续'
    });
    expect(await service.recoverSessionToCheckpoint({ sessionId: 'session-1', reason: 'rollback' })).toEqual({
      id: 'session-1',
      recovered: true
    });
    expect(service.subscribeSession('session-1', listener)).toBe(unsubscribe);

    expect(sessionCoordinator.deleteSession).toHaveBeenCalledWith('session-1');
    expect(sessionCoordinator.recoverToCheckpoint).toHaveBeenCalledWith('session-1', {
      sessionId: 'session-1',
      reason: 'rollback'
    });
    expect(sessionCoordinator.subscribe).toHaveBeenCalledWith('session-1', listener);
  });

  it('对缺失 session 抛出 NotFoundException', async () => {
    const { service } = createService();

    expect(() => service.getSession('missing-session')).toThrow(NotFoundException);
    await expect(service.deleteSession('missing-session')).rejects.toBeInstanceOf(NotFoundException);
  });
});
