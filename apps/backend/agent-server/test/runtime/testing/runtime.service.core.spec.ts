import { NotFoundException } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { RuntimeService } from '../../../src/runtime/runtime.service';
import { collaborators, createService } from './runtime.service.test-helpers';

describe('RuntimeService core', () => {
  const ORIGINAL_RESEARCH_ENDPOINT = process.env.MCP_RESEARCH_HTTP_ENDPOINT;
  const ORIGINAL_RESEARCH_API_KEY = process.env.MCP_RESEARCH_HTTP_API_KEY;
  const ORIGINAL_BIGMODEL_WEB_SEARCH_ENDPOINT = process.env.MCP_BIGMODEL_WEB_SEARCH_ENDPOINT;
  const ORIGINAL_BIGMODEL_WEB_READER_ENDPOINT = process.env.MCP_BIGMODEL_WEB_READER_ENDPOINT;
  const ORIGINAL_BIGMODEL_ZREAD_ENDPOINT = process.env.MCP_BIGMODEL_ZREAD_ENDPOINT;

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

    if (ORIGINAL_BIGMODEL_WEB_SEARCH_ENDPOINT == null) {
      delete process.env.MCP_BIGMODEL_WEB_SEARCH_ENDPOINT;
    } else {
      process.env.MCP_BIGMODEL_WEB_SEARCH_ENDPOINT = ORIGINAL_BIGMODEL_WEB_SEARCH_ENDPOINT;
    }

    if (ORIGINAL_BIGMODEL_WEB_READER_ENDPOINT == null) {
      delete process.env.MCP_BIGMODEL_WEB_READER_ENDPOINT;
    } else {
      process.env.MCP_BIGMODEL_WEB_READER_ENDPOINT = ORIGINAL_BIGMODEL_WEB_READER_ENDPOINT;
    }

    if (ORIGINAL_BIGMODEL_ZREAD_ENDPOINT == null) {
      delete process.env.MCP_BIGMODEL_ZREAD_ENDPOINT;
    } else {
      process.env.MCP_BIGMODEL_ZREAD_ENDPOINT = ORIGINAL_BIGMODEL_ZREAD_ENDPOINT;
    }
  });

  it('在模块初始化时初始化会话协调器，并委托任务/会话查询', async () => {
    const service = createService();

    await service.onModuleInit();

    expect(collaborators(service).sessionCoordinator.initialize).toHaveBeenCalledTimes(1);
    expect(service.describeGraph()).toEqual(['Goal Intake']);
    expect(service.listTasks()).toEqual([expect.objectContaining({ id: 'task-1' })]);
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
    expect((await service.getRuntimeCenter()).recentAgentErrors).toEqual([]);
    expect((await service.getEvalsCenter()).promptRegression).toEqual(
      expect.objectContaining({
        promptCount: expect.any(Number),
        promptSuiteCount: expect.any(Number),
        testCount: expect.any(Number),
        providerCount: expect.any(Number),
        suites: expect.any(Array)
      })
    );
  }, 15000);

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
    collaborators(service).sessionCoordinator.subscribe.mockReturnValue(unsubscribe);

    expect(await service.createTask({ goal: 'demo' })).toEqual({ id: 'task-1', goal: 'demo' });
    expect(await service.createSession({ title: '测试会话' })).toEqual({ id: 'session-1', title: '测试会话' });
    expect(await service.appendSessionMessage('session-1', { message: '继续' })).toEqual({
      sessionId: 'session-1',
      message: '继续'
    });
    expect(
      await service.approveSessionAction('session-1', { actor: 'tester', sessionId: 'session-1' } as never)
    ).toEqual({ id: 'session-1', actor: 'tester', sessionId: 'session-1' });
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
      documentUri: 'file:///doc.md',
      status: 'queued'
    });
    expect(await service.createResearchLearningJob({ goal: '学习 LangGraph' })).toEqual({
      id: 'job-2',
      goal: '学习 LangGraph',
      status: 'queued'
    });
    expect(service.getLearningJob('job-1')).toEqual({ id: 'job-1' });
  });

  it('配置 research MCP endpoint 时会暴露远端 connector', async () => {
    process.env.ZHIPU_API_KEY = 'platform-token';
    process.env.MCP_BIGMODEL_WEB_SEARCH_ENDPOINT = 'https://mcp.example.com/web-search';
    process.env.MCP_BIGMODEL_WEB_READER_ENDPOINT = 'https://mcp.example.com/web-reader';
    process.env.MCP_BIGMODEL_ZREAD_ENDPOINT = 'https://mcp.example.com/zread';
    process.env.MCP_RESEARCH_HTTP_ENDPOINT = 'https://mcp.example.com/research';
    process.env.MCP_RESEARCH_HTTP_API_KEY = 'secret-token';

    const service = new RuntimeService();
    const connectors = await service.getConnectorsCenter();

    expect(connectors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'remote-research', transport: 'http', healthState: 'healthy' }),
        expect.objectContaining({ id: 'bigmodel-web-search', transport: 'http', healthState: 'healthy' }),
        expect.objectContaining({ id: 'bigmodel-web-reader', transport: 'http', healthState: 'healthy' }),
        expect.objectContaining({ id: 'bigmodel-zread', transport: 'http', healthState: 'healthy' }),
        expect.objectContaining({ id: 'bigmodel-vision', transport: 'stdio', healthState: 'healthy' })
      ])
    );
  });

  it('支持导出 runtime、approvals 与 evals center 数据', async () => {
    const service = createService();

    const runtimeExport = await service.exportRuntimeCenter({
      days: 7,
      executionMode: 'plan',
      interactionKind: 'plan-question',
      format: 'csv'
    });
    const approvalsExport = await service.exportApprovalsCenter({
      executionMode: 'plan',
      interactionKind: 'plan-question',
      format: 'csv'
    });
    const evalsExport = await service.exportEvalsCenter({ days: 7, format: 'csv' });

    expect(runtimeExport.filename).toContain('runtime-center-7d');
    expect(runtimeExport.mimeType).toBe('text/csv');
    expect(runtimeExport.content).toContain('day,tokens,costUsd,costCny,runs,overBudget');
    expect(runtimeExport.content).toContain(
      'filterStatus,filterModel,filterPricingSource,filterExecutionMode,filterInteractionKind'
    );
    expect(runtimeExport.content).toContain(
      'taskId,status,executionMode,currentMinistry,requestedBy,interruptSource,interactionKind,currentWorker,selectedAgents,selectionSources,streamNode,streamDetail,streamProgressPercent,compressionApplied,compressionSource,compressedMessageCount,updatedAt'
    );
    expect(approvalsExport.filename).toContain('approvals-center');
    expect(approvalsExport.mimeType).toBe('text/csv');
    expect(approvalsExport.content).toContain('filterExecutionMode,filterInteractionKind');
    expect(approvalsExport.content).toContain(
      'taskId,status,executionMode,currentMinistry,requestedBy,interruptSource,interactionKind,currentWorker,selectedAgents,selectionSources,intent,toolName,riskLevel,reason,commandPreview,riskReason,riskCode,approvalScope,policyMatchStatus,policyMatchSource,lastStreamStatusAt'
    );
    expect(evalsExport.filename).toContain('evals-center-7d');
    expect(evalsExport.mimeType).toBe('text/csv');
    expect(evalsExport.content).toContain('day,runCount,passCount,passRate');
  }, 15000);

  it('platform console context 直接依赖 centers service，而不是回调 RuntimeService compat 方法', async () => {
    const service = createService();
    const centersService = (service as any).centersService as {
      getRuntimeCenter: ReturnType<typeof vi.fn>;
      getConnectorsCenter: ReturnType<typeof vi.fn>;
    };
    const contextFactory = (service as any).contextFactory as {
      getPlatformConsoleContext: () => {
        getRuntimeCenter: (days?: number, filters?: Record<string, unknown>) => Promise<unknown>;
        getConnectorsCenter: () => Promise<unknown>;
      };
    };
    const runtimeCenterValue = { source: 'centers-service' };
    const connectorsValue = [{ id: 'connector-from-centers-service' }];

    centersService.getRuntimeCenter = vi.fn(async () => runtimeCenterValue);
    centersService.getConnectorsCenter = vi.fn(async () => connectorsValue);
    (service as any).getRuntimeCenter = vi.fn(async () => {
      throw new Error('compat facade should not be used by platform console context');
    });
    (service as any).getConnectorsCenter = vi.fn(async () => {
      throw new Error('compat facade should not be used by platform console context');
    });

    await expect(contextFactory.getPlatformConsoleContext().getRuntimeCenter(7, { status: 'completed' })).resolves.toBe(
      runtimeCenterValue
    );
    await expect(contextFactory.getPlatformConsoleContext().getConnectorsCenter()).resolves.toBe(connectorsValue);
    expect(centersService.getRuntimeCenter).toHaveBeenCalledWith(7, { status: 'completed' });
    expect(centersService.getConnectorsCenter).toHaveBeenCalledTimes(1);
  });

  it('支持创建 agent diagnosis task', async () => {
    const service = createService();
    const c = collaborators(service);
    c.orchestrator.getTask.mockImplementation((id: string) =>
      id === 'task-agent-error'
        ? {
            id,
            goal: '检查最近 AI 技术进展',
            currentNode: 'hubu_research',
            currentStep: 'research',
            currentWorker: 'hubu-search-worker',
            trace: [
              { at: '2026-03-27T10:00:00.000Z', node: 'research', summary: '户部已开始检索资料' },
              { at: '2026-03-27T10:01:00.000Z', node: 'agent_error', summary: '户部执行失败 timeout' }
            ]
          }
        : undefined
    );
    c.orchestrator.createTask.mockResolvedValue({ id: 'diagnosis-task-1', goal: 'diagnosis goal' });

    const task = await service.createAgentDiagnosisTask({
      taskId: 'task-agent-error',
      goal: '检查最近 AI 技术进展',
      errorCode: 'provider_transient_error',
      ministry: 'hubu-search',
      message: 'research provider timeout',
      diagnosisHint: '更像是上游瞬时波动',
      recommendedAction: '优先重试',
      recoveryPlaybook: ['先刷新运行态', '重试当前任务'],
      stack: 'TimeoutError: research provider timeout'
    });

    expect(task).toEqual({ id: 'diagnosis-task-1', goal: 'diagnosis goal' });
    expect(c.orchestrator.createTask).toHaveBeenCalledWith(
      expect.objectContaining({
        context: 'diagnosis_for:task-agent-error',
        constraints: expect.arrayContaining(['prefer-xingbu-diagnosis', 'preserve-trace-context']),
        goal: expect.stringContaining('请诊断任务 task-agent-error 的 agent 错误并给出恢复方案。')
      })
    );
  });
});
