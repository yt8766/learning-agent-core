import { describe, expect, it, vi } from 'vitest';

import { ActionIntent, TaskStatus } from '@agent/core';
import type { RuntimeStateRepository, RuntimeStateSnapshot } from '@agent/memory';

import { SessionCoordinator } from '../src/session/coordinator/session-coordinator';
import { generateSessionTitleFromSummary } from '../src/session/coordinator/session-coordinator-routing-hints';

function createEmptyRuntimeState(): RuntimeStateSnapshot {
  return {
    tasks: [],
    learningJobs: [],
    learningQueue: [],
    pendingExecutions: [],
    channelDeliveries: [],
    chatSessions: [],
    chatMessages: [],
    chatEvents: [],
    chatCheckpoints: [],
    crossCheckEvidence: [],
    governance: {
      disabledSkillSourceIds: [],
      disabledCompanyWorkerIds: [],
      disabledConnectorIds: [],
      configuredConnectors: [],
      connectorDiscoveryHistory: [],
      connectorPolicyOverrides: [],
      capabilityPolicyOverrides: [],
      capabilityGovernanceProfiles: [],
      ministryGovernanceProfiles: [],
      workerGovernanceProfiles: [],
      specialistGovernanceProfiles: [],
      counselorSelectorConfigs: [],
      approvalScopePolicies: [],
      learningConflictScan: {
        scannedAt: '',
        conflictPairs: [],
        mergeSuggestions: [],
        manualReviewQueue: []
      }
    },
    governanceAudit: [],
    usageHistory: [],
    evalHistory: [],
    usageAudit: []
  };
}

class InMemoryRuntimeStateRepository implements RuntimeStateRepository {
  snapshot = createEmptyRuntimeState();

  async load(): Promise<RuntimeStateSnapshot> {
    return this.snapshot;
  }

  async save(snapshot: RuntimeStateSnapshot): Promise<void> {
    this.snapshot = snapshot;
  }
}

function createSessionOrchestratorStub() {
  return {
    async initialize() {},
    createTask: vi.fn(async (dto: { goal: string; sessionId?: string }) => ({
      id: `task-${Date.now()}`,
      goal: dto.goal,
      sessionId: dto.sessionId,
      status: TaskStatus.QUEUED,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    })),
    async cancelTask() {
      return null;
    },
    subscribe() {
      return () => {};
    },
    subscribeTokens() {
      return () => {};
    }
  };
}

function createLlmProviderStub(response = 'Codex 是一个面向代码和开发任务的 AI 助手。') {
  return {
    providerId: 'test',
    displayName: 'Test LLM',
    supportedModels: vi.fn(() => []),
    isConfigured: vi.fn(() => true),
    generateText: vi.fn(async () => response),
    streamText: vi.fn(async (_messages, _options, onToken: (token: string) => void) => {
      for (const token of response.split('')) {
        onToken(token);
      }
      return response;
    }),
    generateObject: vi.fn()
  };
}

async function waitForCondition(assertion: () => boolean | undefined, timeoutMs = 500): Promise<void> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (assertion()) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  expect(assertion()).toBe(true);
}

describe('@agent/runtime session inline capability integration', () => {
  it('answers general chat prompts through the session direct-reply fast path without creating a runtime task', async () => {
    const repository = new InMemoryRuntimeStateRepository();
    const orchestrator = createSessionOrchestratorStub();
    const llmProvider = createLlmProviderStub('Codex 是 OpenAI 的代码协作智能体。');
    const coordinator = new SessionCoordinator(orchestrator as never, repository, llmProvider as never);

    const session = await coordinator.createSession({});
    const userMessage = await coordinator.appendMessage(session.id, {
      message: 'codex 是什么'
    });

    await waitForCondition(() => coordinator.getSession(session.id)?.status === 'completed');

    const messages = coordinator.getMessages(session.id);
    const events = coordinator.getEvents(session.id);
    const checkpoint = coordinator.getCheckpoint(session.id);

    expect(userMessage.role).toBe('user');
    expect(orchestrator.createTask).not.toHaveBeenCalled();
    expect(llmProvider.streamText).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ role: 'system', content: expect.stringContaining('不要启动任务编排') }),
        expect.objectContaining({ role: 'user', content: 'codex 是什么' })
      ]),
      expect.objectContaining({ role: 'manager', temperature: 0.2 }),
      expect.any(Function)
    );
    expect(messages.map(item => item.role)).toEqual(['user', 'assistant']);
    expect(messages[1]?.content).toBe('Codex 是 OpenAI 的代码协作智能体。');
    expect(messages[1]?.cognitionSnapshot?.thoughtChain?.length).toBeGreaterThan(0);
    expect(messages[1]?.cognitionSnapshot?.thinkState?.loading).toBeFalsy();
    expect(events.map(item => item.type)).toEqual(
      expect.arrayContaining(['user_message', 'node_status', 'assistant_token', 'assistant_message'])
    );
    expect(checkpoint?.chatRoute).toMatchObject({
      flow: 'direct-reply',
      reason: 'session_fast_path_general_prompt'
    });
    expect(checkpoint?.graphState).toMatchObject({
      status: 'completed',
      currentStep: 'direct_reply'
    });
  });

  it('removes think tags from the persisted direct-reply assistant message and completion events', async () => {
    const repository = new InMemoryRuntimeStateRepository();
    const orchestrator = createSessionOrchestratorStub();
    const llmProvider = createLlmProviderStub('<think>先组织答案</think>镜像是模板，容器是运行实例。');
    const coordinator = new SessionCoordinator(orchestrator as never, repository, llmProvider as never);

    const session = await coordinator.createSession({});
    await coordinator.appendMessage(session.id, {
      message: 'docker 镜像和容器有什么区别'
    });

    await waitForCondition(() => coordinator.getSession(session.id)?.status === 'completed');

    const messages = coordinator.getMessages(session.id);
    const assistantMessage = messages.find(message => message.role === 'assistant');
    const assistantEvents = coordinator
      .getEvents(session.id)
      .filter(event => event.type === 'assistant_message' || event.type === 'final_response_completed');

    expect(assistantMessage?.content).toBe('镜像是模板，容器是运行实例。');
    expect(assistantMessage?.content).not.toContain('<think>');
    expect(assistantEvents).toHaveLength(2);
    for (const event of assistantEvents) {
      expect(event.payload).toMatchObject({
        content: '镜像是模板，容器是运行实例。'
      });
      expect(JSON.stringify(event.payload)).not.toContain('<think>');
    }
  });

  it('removes an unclosed trailing think block from persisted direct-reply content', async () => {
    const repository = new InMemoryRuntimeStateRepository();
    const orchestrator = createSessionOrchestratorStub();
    const llmProvider = createLlmProviderStub('镜像是模板，容器是运行实例。<think>这里不应进入最终答案');
    const coordinator = new SessionCoordinator(orchestrator as never, repository, llmProvider as never);

    const session = await coordinator.createSession({});
    await coordinator.appendMessage(session.id, {
      message: 'docker 镜像和容器有什么区别'
    });

    await waitForCondition(() => coordinator.getSession(session.id)?.status === 'completed');

    const assistantMessage = coordinator.getMessages(session.id).find(message => message.role === 'assistant');
    const finalEvent = coordinator.getEvents(session.id).find(event => event.type === 'final_response_completed');

    expect(assistantMessage?.content).toBe('镜像是模板，容器是运行实例。');
    expect(JSON.stringify(finalEvent?.payload)).not.toContain('<think>');
  });

  it('answers present-tense identity questions through direct reply instead of routing to a runtime task', async () => {
    const repository = new InMemoryRuntimeStateRepository();
    const orchestrator = createSessionOrchestratorStub();
    const llmProvider = createLlmProviderStub('Codex 是 OpenAI 的代码协作智能体。');
    const coordinator = new SessionCoordinator(orchestrator as never, repository, llmProvider as never);

    const session = await coordinator.createSession({});
    await coordinator.appendMessage(session.id, {
      message: '现在codex是什么'
    });

    await waitForCondition(() => coordinator.getSession(session.id)?.status === 'completed');

    expect(orchestrator.createTask).not.toHaveBeenCalled();
    expect(llmProvider.streamText).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ role: 'user', content: '现在codex是什么' })]),
      expect.objectContaining({ role: 'manager', temperature: 0.2 }),
      expect.any(Function)
    );
    expect(coordinator.getMessages(session.id).map(item => item.role)).toEqual(['user', 'assistant']);
  });

  it('keeps direct-reply context in a single system message for MiniMax-compatible chat providers', async () => {
    const repository = new InMemoryRuntimeStateRepository();
    const orchestrator = createSessionOrchestratorStub();
    const llmProvider = createLlmProviderStub('第二轮回复');
    const coordinator = new SessionCoordinator(orchestrator as never, repository, llmProvider as never);

    const session = await coordinator.createSession({});
    await coordinator.appendMessage(session.id, {
      message: 'codex 是什么'
    });
    await waitForCondition(() => coordinator.getSession(session.id)?.status === 'completed');

    await coordinator.appendMessage(session.id, {
      message: '继续解释一下'
    });
    await waitForCondition(() => llmProvider.streamText.mock.calls.length === 2);

    const secondCallMessages = llmProvider.streamText.mock.calls[1]?.[0] ?? [];
    const systemMessages = secondCallMessages.filter(message => message.role === 'system');

    expect(systemMessages).toHaveLength(1);
    expect(systemMessages[0]?.content).toContain('不要启动任务编排');
    expect(systemMessages[0]?.content).toContain('可用的近期对话上下文如下');
    expect(secondCallMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ role: 'user', content: '继续解释一下' })])
    );
  });

  it('keeps execution-like prompts on the runtime task path', async () => {
    const repository = new InMemoryRuntimeStateRepository();
    const orchestrator = createSessionOrchestratorStub();
    const llmProvider = createLlmProviderStub();
    const coordinator = new SessionCoordinator(orchestrator as never, repository, llmProvider as never);

    const session = await coordinator.createSession({});
    await coordinator.appendMessage(session.id, {
      message: '帮我实现一个 approval recovery 的回归测试'
    });

    await waitForCondition(() => orchestrator.createTask.mock.calls.length > 0);

    expect(llmProvider.streamText).not.toHaveBeenCalled();
    expect(orchestrator.createTask).toHaveBeenCalledWith(
      expect.objectContaining({
        goal: '帮我实现一个 approval recovery 的回归测试',
        sessionId: session.id
      })
    );
  });

  it('persists session, messages, events and checkpoint for inline capability replies', async () => {
    const repository = new InMemoryRuntimeStateRepository();
    const llmProvider = createLlmProviderStub('Runtime 审批恢复状态总结');
    const coordinator = new SessionCoordinator(
      createSessionOrchestratorStub() as never,
      repository,
      llmProvider as never
    );

    const session = await coordinator.createSession({});

    expect(session.title).toBe('新会话');
    expect(coordinator.getEvents(session.id)).toHaveLength(1);

    const userMessage = await coordinator.appendInlineCapabilityResponse(
      session.id,
      {
        message: '帮我总结 runtime approval recovery 的当前状态'
      },
      {
        content: 'approval recovery 主链已经具备最小 integration 覆盖。'
      }
    );

    const persistedSession = coordinator.getSession(session.id);
    const messages = coordinator.getMessages(session.id);
    const events = coordinator.getEvents(session.id);
    const checkpoint = coordinator.getCheckpoint(session.id);

    expect(userMessage.role).toBe('user');
    expect(userMessage.content).toBe('帮我总结 runtime approval recovery 的当前状态');
    expect(llmProvider.generateText).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ role: 'system', content: expect.stringContaining('生成一个会话标题') }),
        expect.objectContaining({ role: 'user', content: expect.stringContaining('runtime approval recovery') })
      ]),
      expect.objectContaining({ role: 'manager', temperature: 0.1, maxTokens: 24 })
    );
    expect(persistedSession?.title).toBe('Runtime 审批恢复状态总结');
    expect(persistedSession?.titleSource).toBe('generated');
    expect(persistedSession?.status).toBe('completed');
    expect(messages.map(item => item.role)).toEqual(['user', 'assistant']);
    expect(messages[1]?.content).toBe('approval recovery 主链已经具备最小 integration 覆盖。');
    expect(events.map(item => item.type)).toEqual([
      'session_started',
      'user_message',
      'assistant_message',
      'final_response_completed'
    ]);
    expect(checkpoint).toMatchObject({
      taskId: `inline-capability:${session.id}`,
      pendingApprovals: []
    });
    expect(checkpoint?.graphState).toMatchObject({
      status: 'completed'
    });

    expect(repository.snapshot.chatSessions).toHaveLength(1);
    expect(repository.snapshot.chatMessages).toHaveLength(2);
    expect(repository.snapshot.chatEvents).toHaveLength(4);
    expect(repository.snapshot.chatCheckpoints).toHaveLength(1);
  });

  it('does not overwrite a manually renamed session title with generated summaries', async () => {
    const repository = new InMemoryRuntimeStateRepository();
    const llmProvider = {
      isConfigured: vi.fn(() => true),
      generateText: vi.fn(async () => '模型摘要标题')
    };
    const coordinator = new SessionCoordinator(
      createSessionOrchestratorStub() as never,
      repository,
      llmProvider as never
    );

    const session = await coordinator.createSession({});
    await coordinator.updateSession(session.id, { title: '我手动改的标题', titleSource: 'manual' });

    await coordinator.appendInlineCapabilityResponse(
      session.id,
      {
        message: '帮我总结 runtime approval recovery 的当前状态'
      },
      {
        content: 'approval recovery 主链已经具备最小 integration 覆盖。'
      }
    );

    expect(llmProvider.generateText).not.toHaveBeenCalled();
    expect(coordinator.getSession(session.id)).toMatchObject({
      title: '我手动改的标题',
      titleSource: 'manual'
    });
  });

  it('falls back to a concise local title when the title model echoes instructions', async () => {
    const llmProvider = {
      isConfigured: vi.fn(() => true),
      generateText: vi.fn(
        async () => '用户要求我根据用户的第一条消息"你是谁，你会做什么"生成一个会话标题。要求：必须是摘要，不要照抄原文'
      )
    };

    await expect(generateSessionTitleFromSummary(llmProvider, '你是谁，你会做什么')).resolves.toBe('能力介绍');
  });

  it('does not use leaked title instructions as the session title for present-tense identity questions', async () => {
    const llmProvider = {
      isConfigured: vi.fn(() => true),
      generateText: vi.fn(async () => '用户要求我根据用户的第一条消息"现在codex是什么"生成一个会话标题。 要求： - 标题')
    };

    await expect(generateSessionTitleFromSummary(llmProvider, '现在codex是什么')).resolves.toBe('Codex 介绍');
  });

  it('does not keep chat send loading while waiting for a stalled title model', async () => {
    vi.useFakeTimers();
    const llmProvider = {
      isConfigured: vi.fn(() => true),
      generateText: vi.fn(() => new Promise<string>(() => undefined))
    };

    try {
      const titlePromise = generateSessionTitleFromSummary(llmProvider, '你是谁，你会做什么');
      await vi.advanceTimersByTimeAsync(1600);
      await expect(titlePromise).resolves.toBe('能力介绍');
    } finally {
      vi.useRealTimers();
    }
  });

  it('settles direct reply sessions as failed when the streaming model stalls', async () => {
    vi.useFakeTimers();
    const repository = new InMemoryRuntimeStateRepository();
    const llmProvider = {
      isConfigured: vi.fn(() => true),
      generateText: vi.fn(async () => '能力介绍'),
      streamText: vi.fn(() => new Promise<string>(() => undefined))
    };
    const coordinator = new SessionCoordinator(
      createSessionOrchestratorStub() as never,
      repository,
      llmProvider as never
    );

    try {
      const session = await coordinator.createSession({});
      await coordinator.appendMessage(session.id, {
        message: '你是谁，你会做什么'
      });

      expect(coordinator.getSession(session.id)?.status).toBe('running');

      await vi.advanceTimersByTimeAsync(31_000);
      await Promise.resolve();

      expect(coordinator.getSession(session.id)?.status).toBe('failed');
      expect(coordinator.getCheckpoint(session.id)?.graphState?.status).toBe(TaskStatus.FAILED);
      expect(coordinator.getCheckpoint(session.id)?.thinkState?.loading).toBe(false);
      expect(coordinator.getEvents(session.id).map(event => event.type)).toContain('session_failed');
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps a visible assistant failure message when direct reply throws before streaming tokens', async () => {
    const repository = new InMemoryRuntimeStateRepository();
    const llmProvider = {
      isConfigured: vi.fn(() => true),
      generateText: vi.fn(async () => 'Codex 介绍'),
      streamText: vi.fn(async () => {
        throw new Error('provider 400 invalid chat setting');
      })
    };
    const coordinator = new SessionCoordinator(
      createSessionOrchestratorStub() as never,
      repository,
      llmProvider as never
    );

    const session = await coordinator.createSession({});
    await coordinator.appendMessage(session.id, {
      message: 'codex是什么'
    });

    await waitForCondition(() => coordinator.getSession(session.id)?.status === 'failed');

    const messages = coordinator.getMessages(session.id);
    expect(messages.map(item => item.role)).toEqual(['user', 'assistant']);
    expect(messages[1]?.content).toContain('这轮回复生成失败');
    expect(coordinator.getEvents(session.id).map(event => event.type)).toContain('assistant_message');
    expect(coordinator.getEvents(session.id).map(event => event.type)).toContain('session_failed');
  });

  it('recovers a session back to a checkpoint cursor and restores waiting approval state', async () => {
    const repository = new InMemoryRuntimeStateRepository();
    const coordinator = new SessionCoordinator(createSessionOrchestratorStub() as never, repository, {} as never);

    const session = await coordinator.createSession({});
    await coordinator.appendInlineCapabilityResponse(
      session.id,
      {
        message: '先记录一个可恢复的最小会话'
      },
      {
        content: '已经生成最小闭环响应。'
      }
    );

    const checkpoint = coordinator.getCheckpoint(session.id);
    expect(checkpoint).toBeDefined();

    checkpoint!.traceCursor = 7;
    checkpoint!.messageCursor = 6;
    checkpoint!.approvalCursor = 5;
    checkpoint!.learningCursor = 4;
    checkpoint!.graphState = {
      ...checkpoint!.graphState,
      status: TaskStatus.WAITING_APPROVAL
    };
    checkpoint!.pendingApproval = {
      toolName: 'filesystem',
      intent: ActionIntent.WRITE_FILE,
      requestedBy: 'gongbu-code',
      reason: '等待人工审批后继续写文件'
    };

    const recovered = await coordinator.recoverToCheckpoint(session.id, {
      sessionId: session.id,
      checkpointId: checkpoint!.checkpointId,
      checkpointCursor: 3,
      reason: '用户要求回退到审批前检查点'
    });

    const refreshedCheckpoint = coordinator.getCheckpoint(session.id);
    const events = coordinator.getEvents(session.id);

    expect(recovered.status).toBe('waiting_approval');
    expect(refreshedCheckpoint).toMatchObject({
      traceCursor: 3,
      messageCursor: 3,
      approvalCursor: 3,
      learningCursor: 3,
      recoverability: 'partial'
    });
    expect(events.at(-1)).toMatchObject({
      type: 'session_started',
      payload: {
        recovered: true,
        checkpointId: checkpoint!.checkpointId,
        checkpointCursor: 3,
        reason: '用户要求回退到审批前检查点'
      }
    });
    expect(repository.snapshot.chatCheckpoints[0]).toMatchObject({
      traceCursor: 3,
      recoverability: 'partial'
    });
  });

  it('cancels a session using checkpoint fallback when no runtime task is available', async () => {
    const repository = new InMemoryRuntimeStateRepository();
    const coordinator = new SessionCoordinator(createSessionOrchestratorStub() as never, repository, {} as never);

    const session = await coordinator.createSession({});
    await coordinator.appendInlineCapabilityResponse(
      session.id,
      {
        message: '准备取消当前最小闭环会话'
      },
      {
        content: '当前会话已经产生 checkpoint。'
      }
    );

    const storedSession = coordinator.getSession(session.id);
    const checkpoint = coordinator.getCheckpoint(session.id);

    storedSession!.status = 'running';
    storedSession!.currentTaskId = checkpoint!.taskId;
    checkpoint!.graphState = {
      ...checkpoint!.graphState,
      status: TaskStatus.RUNNING
    };
    checkpoint!.pendingApproval = {
      toolName: 'filesystem',
      intent: ActionIntent.WRITE_FILE,
      requestedBy: 'gongbu-code',
      reason: '等待取消测试'
    };

    const cancelled = await coordinator.cancel(session.id, {
      reason: '人工终止本轮最小闭环'
    });

    const refreshedCheckpoint = coordinator.getCheckpoint(session.id);
    const events = coordinator.getEvents(session.id);
    const messages = coordinator.getMessages(session.id);

    expect(cancelled.status).toBe('cancelled');
    expect(cancelled.currentTaskId).toBeUndefined();
    expect(refreshedCheckpoint?.graphState).toMatchObject({
      status: TaskStatus.CANCELLED,
      currentStep: 'cancelled'
    });
    expect(refreshedCheckpoint?.pendingApproval).toBeUndefined();
    expect(events.at(-1)).toMatchObject({
      type: 'run_cancelled',
      payload: {
        summary: '执行已终止：人工终止本轮最小闭环'
      }
    });
    expect(messages.at(-1)?.role).toBe('system');
    expect(messages.at(-1)?.content).toBe('已终止当前执行：人工终止本轮最小闭环');
    expect(repository.snapshot.chatSessions[0]?.status).toBe('cancelled');
  });
});
