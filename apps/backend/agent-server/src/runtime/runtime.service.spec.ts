import { NotFoundException } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { RuntimeService } from './runtime.service';

describe('RuntimeService', () => {
  const ORIGINAL_RESEARCH_ENDPOINT = process.env.MCP_RESEARCH_HTTP_ENDPOINT;
  const ORIGINAL_RESEARCH_API_KEY = process.env.MCP_RESEARCH_HTTP_API_KEY;

  afterEach(() => {
    if (ORIGINAL_RESEARCH_ENDPOINT == null) {
      delete process.env.MCP_RESEARCH_HTTP_ENDPOINT;
    } else {
      process.env.MCP_RESEARCH_HTTP_ENDPOINT = ORIGINAL_RESEARCH_ENDPOINT;
    }

    if (ORIGINAL_RESEARCH_API_KEY == null) {
      delete process.env.MCP_RESEARCH_HTTP_API_KEY;
    } else {
      process.env.MCP_RESEARCH_HTTP_API_KEY = ORIGINAL_RESEARCH_API_KEY;
    }
  });

  const createService = () => {
    const service = new RuntimeService() as RuntimeService & {
      orchestrator: any;
      sessionCoordinator: any;
      memoryRepository: any;
      ruleRepository: any;
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
      createResearchLearningJob: vi.fn(async dto => ({ id: 'job-2', ...dto })),
      getLearningJob: vi.fn(id => (id === 'job-1' ? { id } : id === 'job-2' ? { id } : undefined)),
      listLearningJobs: vi.fn(() => [])
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
      list: vi.fn(async () => [{ id: 'memory-1', status: 'active' }]),
      search: vi.fn(async () => [{ id: 'memory-1' }]),
      getById: vi.fn(async id => (id === 'memory-1' ? { id } : undefined)),
      invalidate: vi.fn(async (id, reason) =>
        id === 'memory-1' ? { id, status: 'invalidated', invalidationReason: reason } : undefined
      ),
      supersede: vi.fn(async (id, replacementId, reason) =>
        id === 'memory-1'
          ? { id, status: 'superseded', supersededById: replacementId, invalidationReason: reason }
          : undefined
      ),
      retire: vi.fn(async (id, reason) =>
        id === 'memory-1' ? { id, status: 'retired', invalidationReason: reason } : undefined
      ),
      restore: vi.fn(async id => (id === 'memory-1' ? { id, status: 'active' } : undefined))
    };

    service.skillRegistry = {
      list: vi.fn(async () => [{ id: 'skill-1' }]),
      getById: vi.fn(async id => (id === 'skill-1' ? { id } : undefined)),
      promote: vi.fn(async id => ({ id, status: 'stable' })),
      disable: vi.fn(async id => ({ id, status: 'disabled' })),
      restore: vi.fn(async id => ({ id, status: 'lab' })),
      retire: vi.fn(async id => ({ id, status: 'disabled', retiredAt: '2026-03-24T00:00:00.000Z' }))
    };

    service.ruleRepository = {
      list: vi.fn(async () => [{ id: 'rule-1' }]),
      getById: vi.fn(async id => (id === 'rule-1' ? { id } : undefined)),
      invalidate: vi.fn(async (id, reason) =>
        id === 'rule-1' ? { id, status: 'invalidated', invalidationReason: reason } : undefined
      ),
      supersede: vi.fn(async (id, replacementId, reason) =>
        id === 'rule-1'
          ? { id, status: 'superseded', supersededById: replacementId, invalidationReason: reason }
          : undefined
      ),
      retire: vi.fn(async (id, reason) =>
        id === 'rule-1' ? { id, status: 'retired', invalidationReason: reason } : undefined
      ),
      restore: vi.fn(async id => (id === 'rule-1' ? { id, status: 'active' } : undefined))
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
    expect((await service.getRuntimeCenter()).usageAnalytics).toEqual(
      expect.objectContaining({
        totalEstimatedTokens: expect.any(Number),
        totalEstimatedCostUsd: expect.any(Number),
        totalEstimatedCostCny: expect.any(Number),
        providerMeasuredCostUsd: expect.any(Number),
        estimatedFallbackCostUsd: expect.any(Number),
        measuredRunCount: expect.any(Number),
        estimatedRunCount: expect.any(Number),
        providerBillingStatus: expect.objectContaining({
          status: expect.any(String),
          source: expect.any(String),
          provider: expect.any(String)
        }),
        budgetPolicy: expect.objectContaining({
          dailyTokenWarning: expect.any(Number),
          dailyCostCnyWarning: expect.any(Number),
          totalCostCnyWarning: expect.any(Number)
        }),
        alerts: expect.any(Array),
        daily: expect.any(Array),
        models: expect.any(Array)
      })
    );
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
    expect(await service.invalidateMemory('memory-1', { reason: 'stale' })).toEqual({
      id: 'memory-1',
      status: 'invalidated',
      invalidationReason: 'stale'
    });
    expect(await service.supersedeMemory('memory-1', { replacementId: 'memory-2', reason: 'newer' })).toEqual({
      id: 'memory-1',
      status: 'superseded',
      supersededById: 'memory-2',
      invalidationReason: 'newer'
    });
    expect(await service.restoreMemory('memory-1')).toEqual({ id: 'memory-1', status: 'active' });
    expect(await service.retireMemory('memory-1', { reason: 'cleanup' })).toEqual({
      id: 'memory-1',
      status: 'retired',
      invalidationReason: 'cleanup'
    });
    expect(await service.listSkills()).toEqual([{ id: 'skill-1' }]);
    expect(await service.listLabSkills()).toEqual([{ id: 'skill-1' }]);
    expect(await service.getSkill('skill-1')).toEqual({ id: 'skill-1' });
    expect(await service.promoteSkill('skill-1')).toEqual({ id: 'skill-1', status: 'stable' });
    expect(await service.disableSkill('skill-1')).toEqual({ id: 'skill-1', status: 'disabled' });
    expect(await service.restoreSkill('skill-1')).toEqual({ id: 'skill-1', status: 'lab' });
    expect(await service.retireSkill('skill-1')).toEqual({
      id: 'skill-1',
      status: 'disabled',
      retiredAt: '2026-03-24T00:00:00.000Z'
    });
    expect(await service.listRules()).toEqual([{ id: 'rule-1' }]);
    expect(await service.invalidateRule('rule-1', { reason: 'conflict' })).toEqual({
      id: 'rule-1',
      status: 'invalidated',
      invalidationReason: 'conflict'
    });
    expect(await service.supersedeRule('rule-1', { replacementId: 'rule-2', reason: 'updated' })).toEqual({
      id: 'rule-1',
      status: 'superseded',
      supersededById: 'rule-2',
      invalidationReason: 'updated'
    });
    expect(await service.restoreRule('rule-1')).toEqual({ id: 'rule-1', status: 'active' });
    expect(await service.retireRule('rule-1', { reason: 'cleanup' })).toEqual({
      id: 'rule-1',
      status: 'retired',
      invalidationReason: 'cleanup'
    });
    expect(await service.createDocumentLearningJob({ documentUri: 'file:///doc.md' })).toEqual({
      id: 'job-1',
      documentUri: 'file:///doc.md'
    });
    expect(await service.createResearchLearningJob({ goal: '学习 LangGraph' })).toEqual({
      id: 'job-2',
      goal: '学习 LangGraph'
    });
    expect(service.getLearningJob('job-1')).toEqual({ id: 'job-1' });
  });

  it('配置 research MCP endpoint 时会暴露远端 connector', async () => {
    process.env.ZHIPU_API_KEY = 'platform-token';
    process.env.MCP_RESEARCH_HTTP_ENDPOINT = 'https://mcp.example.com/research';
    process.env.MCP_RESEARCH_HTTP_API_KEY = 'secret-token';

    const service = new RuntimeService();
    const connectors = await service.getConnectorsCenter();

    expect(connectors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'remote-research',
          transport: 'http',
          healthState: 'healthy'
        }),
        expect.objectContaining({
          id: 'bigmodel-web-search',
          transport: 'http',
          healthState: 'healthy'
        }),
        expect.objectContaining({
          id: 'bigmodel-web-reader',
          transport: 'http',
          healthState: 'healthy'
        }),
        expect.objectContaining({
          id: 'bigmodel-zread',
          transport: 'http',
          healthState: 'healthy'
        }),
        expect.objectContaining({
          id: 'bigmodel-vision',
          transport: 'stdio',
          healthState: 'healthy'
        })
      ])
    );
  });

  it('支持导出 runtime 与 evals center 数据', async () => {
    const service = createService();

    const runtimeExport = await service.exportRuntimeCenter({ days: 7, format: 'csv' });
    const evalsExport = await service.exportEvalsCenter({ days: 7, format: 'csv' });

    expect(runtimeExport.filename).toContain('runtime-center-7d');
    expect(runtimeExport.mimeType).toBe('text/csv');
    expect(runtimeExport.content).toContain('day,tokens,costUsd,costCny,runs,overBudget');

    expect(evalsExport.filename).toContain('evals-center-7d');
    expect(evalsExport.mimeType).toBe('text/csv');
    expect(evalsExport.content).toContain('day,runCount,passCount,passRate');
  });

  it('支持关闭 connector session', async () => {
    const service = createService();
    (service as unknown as { mcpClientManager: { closeServerSession: ReturnType<typeof vi.fn> } }).mcpClientManager = {
      closeServerSession: vi.fn(async () => true)
    };

    await expect(service.closeConnectorSession('vision')).resolves.toEqual({
      connectorId: 'vision',
      closed: true
    });
  });
});
