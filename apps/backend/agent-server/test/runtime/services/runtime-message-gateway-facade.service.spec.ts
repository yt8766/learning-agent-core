import { describe, expect, it, vi } from 'vitest';

import { RuntimeMessageGatewayFacadeService } from '../../../src/runtime/services/runtime-message-gateway-facade.service';

describe('RuntimeMessageGatewayFacadeService', () => {
  it('组合 session 与 task provider，向 gateway 暴露稳定 facade', async () => {
    const runtimeSessionService = {
      listSessions: vi.fn(() => [{ id: 'session-1' }]),
      createSession: vi.fn(async dto => ({ id: 'session-1', ...dto })),
      appendSessionMessage: vi.fn(async (sessionId, dto) => ({ sessionId, ...dto })),
      getSessionCheckpoint: vi.fn(() => ({ sessionId: 'session-1', taskId: 'task-1' })),
      getSession: vi.fn(() => ({ id: 'session-1' })),
      listSessionMessages: vi.fn(() => [{ id: 'msg-1' }]),
      recoverSessionToCheckpoint: vi.fn(async dto => ({ id: dto.sessionId }))
    } as any;
    const runtimeTaskService = {
      getTask: vi.fn(() => ({ id: 'task-1' })),
      approveTaskAction: vi.fn(async () => ({ id: 'task-1', decision: 'approved' })),
      rejectTaskAction: vi.fn(async () => ({ id: 'task-1', decision: 'rejected' }))
    } as any;

    const service = new RuntimeMessageGatewayFacadeService(runtimeSessionService, runtimeTaskService);

    expect(service.listSessions()).toEqual([{ id: 'session-1' }]);
    expect(await service.createSession({ title: 'gateway' } as any)).toEqual({ id: 'session-1', title: 'gateway' });
    expect(await service.appendSessionMessage('session-1', { message: 'hello' } as any)).toEqual({
      sessionId: 'session-1',
      message: 'hello'
    });
    expect(service.getSessionCheckpoint('session-1')).toEqual({ sessionId: 'session-1', taskId: 'task-1' });
    expect(service.getSession('session-1')).toEqual({ id: 'session-1' });
    expect(service.listSessionMessages('session-1')).toEqual([{ id: 'msg-1' }]);
    expect(service.getTask('task-1')).toEqual({ id: 'task-1' });
    expect(await service.approveTaskAction('task-1', { actor: 'tester' } as any)).toEqual({
      id: 'task-1',
      decision: 'approved'
    });
    expect(await service.rejectTaskAction('task-1', { actor: 'tester' } as any)).toEqual({
      id: 'task-1',
      decision: 'rejected'
    });
    expect(await service.recoverSessionToCheckpoint({ sessionId: 'session-1' } as any)).toEqual({ id: 'session-1' });
  });
});
