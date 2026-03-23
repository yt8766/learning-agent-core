import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { RuntimeService } from './runtime.service';

describe('RuntimeService', () => {
  const createService = () => {
    const service = new RuntimeService() as RuntimeService & {
      orchestrator: any;
      sessionCoordinator: any;
      memoryRepository: any;
      skillRegistry: any;
    };

    service.orchestrator = {
      initialize: vi.fn(async () => undefined),
      describeGraph: vi.fn(() => ['Goal Intake']),
      createTask: vi.fn(async dto => ({ id: 'task-1', ...dto })),
      listTasks: vi.fn(() => [{ id: 'task-1' }]),
      listPendingApprovals: vi.fn(() => [{ id: 'task-pending' }]),
      getTask: vi.fn(id => (id === 'task-1' ? { id, trace: [], agentStates: [], messages: [] } : undefined)),
      getTaskAgents: vi.fn(() => [{ role: 'manager' }]),
      getTaskMessages: vi.fn(() => [{ id: 'msg-1' }]),
      getTaskPlan: vi.fn(id => (id === 'task-1' ? { steps: [], subTasks: [] } : undefined)),
      getTaskReview: vi.fn(id =>
        id === 'task-1'
          ? { taskId: id, decision: 'approved', notes: [], createdAt: '2026-03-22T00:00:00.000Z' }
          : undefined
      ),
      retryTask: vi.fn(async id => (id === 'task-1' ? { id } : undefined)),
      applyApproval: vi.fn(async (id, dto, decision) => (id === 'task-1' ? { id, dto, decision } : undefined)),
      listRules: vi.fn(async () => [{ id: 'rule-1' }]),
      createDocumentLearningJob: vi.fn(async dto => ({ id: 'job-1', ...dto })),
      getLearningJob: vi.fn(id => (id === 'job-1' ? { id } : undefined))
    };

    service.sessionCoordinator = {
      initialize: vi.fn(async () => undefined),
      listSessions: vi.fn(() => [{ id: 'session-1' }]),
      createSession: vi.fn(async dto => ({ id: 'session-1', ...dto })),
      getSession: vi.fn(id => (id === 'session-1' ? { id } : undefined)),
      getMessages: vi.fn(() => [{ id: 'chat-msg-1' }]),
      getEvents: vi.fn(() => [{ id: 'chat-event-1' }]),
      getCheckpoint: vi.fn(() => ({ sessionId: 'session-1' })),
      appendMessage: vi.fn(async (id, dto) => ({ sessionId: id, ...dto })),
      approve: vi.fn(async (id, dto) => ({ id, ...dto })),
      reject: vi.fn(async (id, dto) => ({ id, ...dto })),
      confirmLearning: vi.fn(async (id, dto) => ({ id, ...dto })),
      recover: vi.fn(async id => ({ id, recovered: true })),
      subscribe: vi.fn(() => vi.fn())
    };

    service.memoryRepository = {
      search: vi.fn(async () => [{ id: 'memory-1' }]),
      getById: vi.fn(async id => (id === 'memory-1' ? { id } : undefined))
    };

    service.skillRegistry = {
      list: vi.fn(async () => [{ id: 'skill-1' }]),
      getById: vi.fn(async id => (id === 'skill-1' ? { id } : undefined)),
      promote: vi.fn(async id => ({ id, status: 'stable' })),
      disable: vi.fn(async id => ({ id, status: 'disabled' }))
    };

    return service;
  };

  it('在模块初始化时初始化会话协调器，并委托任务/会话查询', async () => {
    const service = createService();

    await service.onModuleInit();

    expect(service.sessionCoordinator.initialize).toHaveBeenCalledTimes(1);
    expect(service.describeGraph()).toEqual(['Goal Intake']);
    expect(service.listTasks()).toEqual([{ id: 'task-1' }]);
    expect(service.listSessions()).toEqual([{ id: 'session-1' }]);
    expect(service.getTask('task-1')).toEqual({ id: 'task-1', trace: [], agentStates: [], messages: [] });
    expect(service.getSession('session-1')).toEqual({ id: 'session-1' });
    expect(service.listSessionMessages('session-1')).toEqual([{ id: 'chat-msg-1' }]);
    expect(service.listSessionEvents('session-1')).toEqual([{ id: 'chat-event-1' }]);
  });

  it('对缺失资源抛出 NotFoundException', async () => {
    const service = createService();

    expect(() => service.getTask('missing-task')).toThrow(NotFoundException);
    expect(() => service.getSession('missing-session')).toThrow(NotFoundException);
    expect(() => service.getTaskPlan('missing-task')).toThrow(NotFoundException);
    expect(() => service.getTaskReview('missing-task')).toThrow(NotFoundException);
    await expect(service.retryTask('missing-task')).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.approveTaskAction('missing-task', { actor: 'tester' } as never)).rejects.toBeInstanceOf(
      NotFoundException
    );
    await expect(service.rejectTaskAction('missing-task', { actor: 'tester' } as never)).rejects.toBeInstanceOf(
      NotFoundException
    );
    await expect(service.getMemory('missing-memory')).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.getSkill('missing-skill')).rejects.toBeInstanceOf(NotFoundException);
    expect(() => service.getLearningJob('missing-job')).toThrow(NotFoundException);
  });

  it('委托聊天、记忆、技能和学习相关写操作', async () => {
    const service = createService();
    const unsubscribe = vi.fn();
    service.sessionCoordinator.subscribe.mockReturnValue(unsubscribe);

    expect(await service.createTask({ goal: 'demo' })).toEqual({ id: 'task-1', goal: 'demo' });
    expect(await service.createSession({ title: '测试会话' })).toEqual({
      id: 'session-1',
      title: '测试会话'
    });
    expect(await service.appendSessionMessage('session-1', { message: '继续' })).toEqual({
      sessionId: 'session-1',
      message: '继续'
    });
    expect(
      await service.approveSessionAction('session-1', { actor: 'tester', sessionId: 'session-1' } as never)
    ).toEqual({
      id: 'session-1',
      actor: 'tester',
      sessionId: 'session-1'
    });
    expect(service.subscribeSession('session-1', vi.fn())).toBe(unsubscribe);
    expect(await service.searchMemory({ query: 'agent' })).toEqual([{ id: 'memory-1' }]);
    expect(await service.getMemory('memory-1')).toEqual({ id: 'memory-1' });
    expect(await service.listSkills()).toEqual([{ id: 'skill-1' }]);
    expect(await service.listLabSkills()).toEqual([{ id: 'skill-1' }]);
    expect(await service.getSkill('skill-1')).toEqual({ id: 'skill-1' });
    expect(await service.promoteSkill('skill-1')).toEqual({ id: 'skill-1', status: 'stable' });
    expect(await service.disableSkill('skill-1')).toEqual({ id: 'skill-1', status: 'disabled' });
    expect(await service.listRules()).toEqual([{ id: 'rule-1' }]);
    expect(await service.createDocumentLearningJob({ documentUri: 'file:///doc.md' })).toEqual({
      id: 'job-1',
      documentUri: 'file:///doc.md'
    });
    expect(service.getLearningJob('job-1')).toEqual({ id: 'job-1' });
  });
});
