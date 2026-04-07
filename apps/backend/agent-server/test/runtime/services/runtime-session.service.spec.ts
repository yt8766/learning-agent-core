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

  it('listSessionMessages 会折叠同 task 的流式 assistant 与最终 assistant 重复项', () => {
    const { service, sessionCoordinator } = createService();
    sessionCoordinator.getMessages.mockReturnValue([
      {
        id: 'direct_reply_task-1',
        sessionId: 'session-1',
        role: 'assistant',
        content: '我是内阁首辅，一个基于大语言模型的智能助手。',
        createdAt: '2026-04-07T00:00:00.000Z'
      },
      {
        id: 'chat_msg_final_1',
        sessionId: 'session-1',
        role: 'assistant',
        taskId: 'task-1',
        content: '我是内阁首辅，一个基于大语言模型的智能助手。',
        createdAt: '2026-04-07T00:00:01.000Z'
      }
    ]);

    expect(service.listSessionMessages('session-1')).toEqual([
      expect.objectContaining({
        id: 'chat_msg_final_1',
        taskId: 'task-1',
        content: '我是内阁首辅，一个基于大语言模型的智能助手。'
      })
    ]);
  });

  it('listSessionMessages 会在最终 assistant 是流式前缀扩展版时保留更完整内容', () => {
    const { service, sessionCoordinator } = createService();
    sessionCoordinator.getMessages.mockReturnValue([
      {
        id: 'summary_stream_task-1',
        sessionId: 'session-1',
        role: 'assistant',
        content: '我是内阁首辅，一个基于大语言模型的智能助手',
        createdAt: '2026-04-07T00:00:00.000Z'
      },
      {
        id: 'chat_msg_final_1',
        sessionId: 'session-1',
        role: 'assistant',
        taskId: 'task-1',
        content: '我是内阁首辅，一个基于大语言模型的智能助手。',
        createdAt: '2026-04-07T00:00:01.000Z'
      }
    ]);

    expect(service.listSessionMessages('session-1')).toEqual([
      expect.objectContaining({
        id: 'chat_msg_final_1',
        content: '我是内阁首辅，一个基于大语言模型的智能助手。'
      })
    ]);
  });

  it('对缺失 session 抛出 NotFoundException', async () => {
    const { service } = createService();

    expect(() => service.getSession('missing-session')).toThrow(NotFoundException);
    await expect(service.deleteSession('missing-session')).rejects.toBeInstanceOf(NotFoundException);
  });
});
