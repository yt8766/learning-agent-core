import { describe, expect, it, vi } from 'vitest';

import { ActionIntent, TaskStatus } from '@agent/shared';

import { SessionCoordinator } from '../src/session/session-coordinator';
import {
  createLlmProvider,
  createOrchestrator,
  createRuntimeRepository,
  flushAsyncWork
} from './session-coordinator.test.utils';

describe('SessionCoordinator lifecycle methods', () => {
  it('attachSessionCapabilities dedupes records and merges installed skills', async () => {
    const runtimeRepository = createRuntimeRepository();
    const orchestrator = createOrchestrator();
    const coordinator = new SessionCoordinator(
      orchestrator as never,
      runtimeRepository as never,
      createLlmProvider() as never
    );

    const session = await coordinator.createSession({ title: 'attach-capabilities' });
    await flushAsyncWork();

    const checkpoint = await coordinator.attachSessionCapabilities(session.id, {
      attachments: [
        { id: 'cap-1', capabilityId: 'browser', source: 'worker' } as any,
        { id: 'cap-1', capabilityId: 'browser', source: 'worker' } as any
      ],
      augmentations: [
        { id: 'aug-1', capabilityId: 'docs', rationale: 'needed' } as any,
        { id: 'aug-1', capabilityId: 'docs', rationale: 'needed' } as any
      ],
      usedInstalledSkills: ['installed-skill:skill-a', 'installed-skill:skill-a', 'installed-skill:skill-b']
    });

    expect(checkpoint.capabilityAttachments).toEqual([{ id: 'cap-1', capabilityId: 'browser', source: 'worker' }]);
    expect(checkpoint.capabilityAugmentations).toEqual([{ id: 'aug-1', capabilityId: 'docs', rationale: 'needed' }]);
    expect(checkpoint.usedInstalledSkills).toEqual(['installed-skill:skill-a', 'installed-skill:skill-b']);
  });

  it('updateSession rejects blank titles and persists valid titles', async () => {
    const runtimeRepository = createRuntimeRepository();
    const orchestrator = createOrchestrator();
    const coordinator = new SessionCoordinator(
      orchestrator as never,
      runtimeRepository as never,
      createLlmProvider() as never
    );

    const session = await coordinator.createSession({ title: 'old-title' });
    await flushAsyncWork();

    await expect(coordinator.updateSession(session.id, { title: '   ' } as any)).rejects.toThrow('会话标题不能为空');

    const updated = await coordinator.updateSession(session.id, { title: 'new-title' } as any);
    expect(updated.title).toBe('new-title');
  });

  it('appendInlineCapabilityResponse records paired user and assistant messages without running a turn', async () => {
    const runtimeRepository = createRuntimeRepository();
    const orchestrator = createOrchestrator();
    const coordinator = new SessionCoordinator(
      orchestrator as never,
      runtimeRepository as never,
      createLlmProvider() as never
    );

    const session = await coordinator.createSession({ title: 'inline-response' });
    await flushAsyncWork();

    const userMessage = await coordinator.appendInlineCapabilityResponse(
      session.id,
      { message: '请直接展示平台健康状态', channelIdentity: 'feishu' },
      {
        role: 'tool',
        content: '平台运行正常',
        card: { type: 'status', title: 'Runtime Health' } as any
      }
    );

    expect(userMessage.role).toBe('user');
    const messages = coordinator.getMessages(session.id);
    expect(messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ role: 'user', content: '请直接展示平台健康状态' }),
        expect.objectContaining({
          role: 'tool',
          content: '平台运行正常',
          card: { type: 'status', title: 'Runtime Health' }
        })
      ])
    );
    expect(coordinator.getSession(session.id)?.channelIdentity).toBe('feishu');
    expect(orchestrator.createTask).not.toHaveBeenCalled();
    expect(coordinator.getEvents(session.id)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'user_message' }),
        expect.objectContaining({ type: 'assistant_message', payload: expect.objectContaining({ role: 'tool' }) })
      ])
    );
  });

  it('appendInlineCapabilityResponse derives a title for default sessions', async () => {
    const runtimeRepository = createRuntimeRepository();
    const orchestrator = createOrchestrator();
    const coordinator = new SessionCoordinator(
      orchestrator as never,
      runtimeRepository as never,
      createLlmProvider() as never
    );

    const session = await coordinator.createSession({});
    await flushAsyncWork();

    await coordinator.appendInlineCapabilityResponse(
      session.id,
      { message: '/browse 这个平台治理方案还缺什么，接下来应该怎么收口' },
      {
        content: '先补高收益短板。'
      }
    );

    expect(coordinator.getSession(session.id)?.title).toBe('这个平台治理方案还缺什么，接下来应该怎么收口');
  });

  it('appendInlineCapabilityResponse settles checkpoint and emits completion for inline capability replies', async () => {
    const runtimeRepository = createRuntimeRepository();
    const orchestrator = createOrchestrator();
    const coordinator = new SessionCoordinator(
      orchestrator as never,
      runtimeRepository as never,
      createLlmProvider() as never
    );

    const session = await coordinator.createSession({ title: 'inline-capability-finish' });
    await flushAsyncWork();
    await coordinator.attachSessionCapabilities(session.id, {
      attachments: [{ id: 'cap-inline', capabilityId: 'skills', source: 'worker' } as any]
    });
    const checkpoint = coordinator.getCheckpoint(session.id);
    if (checkpoint) {
      checkpoint.thinkState = {
        title: '已思考',
        content: '正在整理能力列表',
        loading: true,
        blink: true,
        messageId: 'pending_assistant_session-1'
      } as any;
      checkpoint.graphState = { status: 'running' } as any;
      checkpoint.streamStatus = { nodeId: 'inline', updatedAt: '2026-04-07T00:00:00.000Z' } as any;
      checkpoint.pendingApprovals = [{ id: 'approval-1' } as any];
    }

    await coordinator.appendInlineCapabilityResponse(
      session.id,
      { message: '我现在有什么技能和 mcp' },
      {
        content: '当前会话能力池可见 2 个 skills。'
      }
    );

    expect(coordinator.getSession(session.id)).toEqual(
      expect.objectContaining({
        status: 'completed'
      })
    );
    expect(coordinator.getCheckpoint(session.id)).toEqual(
      expect.objectContaining({
        graphState: expect.objectContaining({ status: 'completed' }),
        thinkState: expect.objectContaining({ loading: false, blink: false }),
        pendingApprovals: []
      })
    );
    expect(coordinator.getEvents(session.id)).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: 'final_response_completed' })])
    );
  });

  it('appendMessage stores channel identity on the session', async () => {
    const runtimeRepository = createRuntimeRepository();
    const orchestrator = createOrchestrator();
    const coordinator = new SessionCoordinator(
      orchestrator as never,
      runtimeRepository as never,
      createLlmProvider() as never
    );

    const session = await coordinator.createSession({ title: 'append-channel' });
    await flushAsyncWork();

    await coordinator.appendMessage(session.id, {
      message: '请继续处理这个任务',
      channelIdentity: 'lark'
    });

    expect(coordinator.getSession(session.id)?.channelIdentity).toBe('lark');
  });

  it('new sessions carry over recent session summary into task context hints', async () => {
    const runtimeRepository = createRuntimeRepository();
    const orchestrator = createOrchestrator();
    const coordinator = new SessionCoordinator(
      orchestrator as never,
      runtimeRepository as never,
      createLlmProvider() as never
    );

    const previous = await coordinator.createSession({ title: '上一个会话' });
    await flushAsyncWork();
    await coordinator.updateSession(previous.id, { title: '上一个会话' } as any);
    const previousSession = coordinator.getSession(previous.id);
    if (previousSession) {
      previousSession.compression = {
        source: 'heuristic',
        summary: '用户希望默认沿用上次的架构图和工具说明语气。',
        condensedMessageCount: 6,
        trigger: 'message_count'
      } as any;
    }

    const next = await coordinator.createSession({ title: '新会话' });
    await flushAsyncWork();
    await coordinator.appendMessage(next.id, { message: '继续刚才的话题，帮我接着做' });
    await flushAsyncWork();

    expect(orchestrator.createTask).toHaveBeenLastCalledWith(
      expect.objectContaining({
        relatedHistory: expect.arrayContaining([
          expect.stringContaining('前序会话《上一个会话》摘要：用户希望默认沿用上次的架构图和工具说明语气。')
        ]),
        context: expect.stringContaining('以下是同一用户最近会话的跨会话延续线索')
      })
    );
  });

  it('resolveAutoApprovalPolicy keeps channel-bound sessions manual without explicit policies', async () => {
    const runtimeRepository = createRuntimeRepository();
    const orchestrator = createOrchestrator();
    const coordinator = new SessionCoordinator(
      orchestrator as never,
      runtimeRepository as never,
      createLlmProvider() as never
    );

    const session = await coordinator.createSession({ title: 'manual-channel', channelIdentity: 'feishu' });
    await flushAsyncWork();

    const autoPolicy = await (coordinator as any).resolveAutoApprovalPolicy(session, {
      id: 'task-manual',
      status: TaskStatus.WAITING_APPROVAL,
      pendingApproval: {
        intent: ActionIntent.WRITE_FILE,
        toolName: 'write_local_file'
      },
      currentMinistry: 'gongbu-code'
    });

    expect(autoPolicy).toBeUndefined();
  });

  it('streams assistant tokens into the session event log', async () => {
    const runtimeRepository = createRuntimeRepository();
    const orchestrator = createOrchestrator();
    const coordinator = new SessionCoordinator(
      orchestrator as never,
      runtimeRepository as never,
      createLlmProvider() as never
    );

    const session = await coordinator.createSession({ title: 'token-stream' });
    await flushAsyncWork();

    const tokenTask = {
      id: 'task-token',
      sessionId: session.id
    };
    orchestrator.getTask.mockImplementation((taskId: string) => (taskId === tokenTask.id ? tokenTask : undefined));

    const tokenListener = (orchestrator.subscribeTokens as any).mock.calls[0]?.[0] as
      | ((event: any) => void)
      | undefined;
    tokenListener?.({
      taskId: 'task-token',
      messageId: 'message-token-1',
      token: '实时增量输出',
      role: 'assistant',
      model: 'gpt-5.4',
      createdAt: '2026-04-02T00:00:00.000Z'
    });
    await flushAsyncWork();

    expect(coordinator.getMessages(session.id)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'message-token-1',
          role: 'assistant',
          content: '实时增量输出'
        })
      ])
    );
    expect(coordinator.getEvents(session.id)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'assistant_token',
          payload: expect.objectContaining({
            taskId: 'task-token',
            messageId: 'message-token-1',
            content: '实时增量输出',
            model: 'gpt-5.4'
          })
        })
      ])
    );
  });

  it('can recover to a checkpoint cursor, skip missing learning tasks, and delete session state', async () => {
    const runtimeRepository = createRuntimeRepository();
    const orchestrator = createOrchestrator() as any;
    orchestrator.deleteSessionState = vi.fn(async () => undefined);
    const coordinator = new SessionCoordinator(
      orchestrator as never,
      runtimeRepository as never,
      createLlmProvider() as never
    );

    const session = await coordinator.createSession({ title: 'checkpoint-recover', message: '请继续推进实现方案' });
    await flushAsyncWork();

    const checkpoint = coordinator.getCheckpoint(session.id)!;
    checkpoint.traceCursor = 3;
    checkpoint.messageCursor = 3;
    checkpoint.approvalCursor = 2;
    checkpoint.learningCursor = 2;
    checkpoint.pendingApproval = {
      intent: ActionIntent.WRITE_FILE,
      toolName: 'write_local_file'
    } as any;
    checkpoint.graphState = {
      status: TaskStatus.WAITING_APPROVAL,
      currentStep: 'approval_gate'
    } as any;

    const recovered = await coordinator.recoverToCheckpoint(session.id, {
      checkpointId: checkpoint.checkpointId,
      checkpointCursor: 1,
      reason: '回到更早检查点'
    });
    expect(recovered.status).toBe('waiting_approval');
    expect(coordinator.getCheckpoint(session.id)).toEqual(
      expect.objectContaining({
        traceCursor: 1,
        messageCursor: 1,
        approvalCursor: 1,
        learningCursor: 1,
        recoverability: 'partial'
      })
    );

    coordinator.getSession(session.id)!.currentTaskId = 'missing-task';
    await expect(
      coordinator.confirmLearning(session.id, {
        candidateIds: ['candidate-1']
      })
    ).resolves.toBe(recovered);
    expect(orchestrator.confirmLearning).not.toHaveBeenCalled();

    await coordinator.deleteSession(session.id);
    expect(orchestrator.deleteSessionState).toHaveBeenCalledWith(session.id);
    expect(coordinator.getSession(session.id)).toBeUndefined();
    expect(coordinator.listSessions().map(item => item.id)).not.toContain(session.id);
  });

  it('does not duplicate the final assistant message when streamed summary already equals task result', async () => {
    const runtimeRepository = createRuntimeRepository();
    let taskListener: ((task: any) => void) | undefined;
    const orchestrator = {
      initialize: vi.fn(async () => undefined),
      subscribe: vi.fn((listener: (task: any) => void) => {
        taskListener = listener;
        return () => true;
      }),
      subscribeTokens: vi.fn(() => () => true),
      createTask: vi.fn(),
      getTask: vi.fn(),
      ensureLearningCandidates: vi.fn(() => []),
      confirmLearning: vi.fn(),
      applyApproval: vi.fn(),
      cancelTask: vi.fn()
    };
    const coordinator = new SessionCoordinator(
      orchestrator as never,
      runtimeRepository as never,
      createLlmProvider() as never
    );

    const session = await coordinator.createSession({ title: 'stream-final-dedupe' });
    await flushAsyncWork();

    taskListener?.({
      id: 'task-stream-dedupe',
      sessionId: session.id,
      status: TaskStatus.COMPLETED,
      trace: [],
      approvals: [],
      agentStates: [],
      messages: [
        {
          id: 'delta-1',
          taskId: 'task-stream-dedupe',
          from: 'manager',
          to: 'manager',
          type: 'summary_delta',
          content: '最终答复',
          createdAt: '2026-04-02T00:00:00.000Z'
        }
      ],
      result: '最终答复',
      createdAt: '2026-04-02T00:00:00.000Z',
      updatedAt: '2026-04-02T00:00:01.000Z',
      currentStep: 'finish',
      retryCount: 0,
      maxRetries: 1
    });
    await flushAsyncWork();

    const assistantMessages = coordinator.getMessages(session.id).filter(message => message.role === 'assistant');
    expect(assistantMessages).toHaveLength(1);
    expect(assistantMessages[0]?.content).toBe('最终答复');
  });

  it('reuses direct reply streaming message instead of appending a second final assistant message', async () => {
    const runtimeRepository = createRuntimeRepository();
    let taskListener: ((task: any) => void) | undefined;
    let tokenListener: ((event: any) => void) | undefined;
    const orchestrator = {
      initialize: vi.fn(async () => undefined),
      subscribe: vi.fn((listener: (task: any) => void) => {
        taskListener = listener;
        return () => true;
      }),
      subscribeTokens: vi.fn((listener: (event: any) => void) => {
        tokenListener = listener;
        return () => true;
      }),
      createTask: vi.fn(),
      getTask: vi.fn((taskId: string) =>
        taskId === 'task-direct-reply'
          ? {
              id: 'task-direct-reply',
              sessionId: 'session-direct-reply'
            }
          : undefined
      ),
      ensureLearningCandidates: vi.fn(() => []),
      confirmLearning: vi.fn(),
      applyApproval: vi.fn(),
      cancelTask: vi.fn()
    };
    const coordinator = new SessionCoordinator(
      orchestrator as never,
      runtimeRepository as never,
      createLlmProvider() as never
    );

    const session = await coordinator.createSession({ title: 'direct-reply-stream-dedupe' });
    await flushAsyncWork();
    orchestrator.getTask.mockImplementation((taskId: string) =>
      taskId === 'task-direct-reply'
        ? {
            id: 'task-direct-reply',
            sessionId: session.id
          }
        : undefined
    );

    tokenListener?.({
      taskId: 'task-direct-reply',
      messageId: 'direct_reply_task-direct-reply',
      token: '我是内阁首辅，一个基于大语言模型的智能助手。',
      role: 'assistant',
      model: 'gpt-5.4',
      createdAt: '2026-04-07T00:00:00.000Z'
    });
    await flushAsyncWork();

    taskListener?.({
      id: 'task-direct-reply',
      sessionId: session.id,
      status: TaskStatus.COMPLETED,
      trace: [],
      approvals: [],
      agentStates: [],
      messages: [
        {
          id: 'summary-1',
          taskId: 'task-direct-reply',
          from: 'manager',
          to: 'manager',
          type: 'summary',
          content: '我是内阁首辅，一个基于大语言模型的智能助手。',
          createdAt: '2026-04-07T00:00:01.000Z'
        }
      ],
      result: '我是内阁首辅，一个基于大语言模型的智能助手。',
      createdAt: '2026-04-07T00:00:00.000Z',
      updatedAt: '2026-04-07T00:00:01.000Z',
      currentStep: 'finish',
      retryCount: 0,
      maxRetries: 1
    });
    await flushAsyncWork();

    const assistantMessages = coordinator
      .getMessages(session.id)
      .filter(message => message.role === 'assistant' && message.content.includes('我是内阁首辅'));

    expect(assistantMessages).toHaveLength(1);
    expect(assistantMessages[0]?.id).toBe('direct_reply_task-direct-reply');
    expect(assistantMessages[0]?.content).toBe('我是内阁首辅，一个基于大语言模型的智能助手。');
  });

  it('emits execution step lifecycle events as task steps change', async () => {
    const runtimeRepository = createRuntimeRepository();
    const orchestrator = createOrchestrator();
    const coordinator = new SessionCoordinator(
      orchestrator as never,
      runtimeRepository as never,
      createLlmProvider() as never
    );

    const session = await coordinator.createSession({ title: 'step-events' });
    await flushAsyncWork();

    orchestrator.createTask.mockImplementationOnce(async dto => {
      const task = {
        id: 'task-steps',
        goal: dto.goal,
        sessionId: dto.sessionId,
        status: TaskStatus.RUNNING,
        trace: [],
        approvals: [],
        agentStates: [],
        messages: [],
        executionSteps: [
          {
            id: 'execution_step_workflow-execute_task-planning',
            route: 'workflow-execute',
            stage: 'task-planning',
            label: '任务规划',
            owner: 'libu',
            status: 'running',
            startedAt: '2026-04-07T00:00:00.000Z',
            detail: '首辅开始规划。'
          },
          {
            id: 'execution_step_workflow-execute_approval-interrupt',
            route: 'workflow-execute',
            stage: 'approval-interrupt',
            label: '审批中断',
            owner: 'system',
            status: 'blocked',
            startedAt: '2026-04-07T00:00:01.000Z',
            reason: '等待审批。'
          }
        ],
        currentExecutionStep: {
          id: 'execution_step_workflow-execute_approval-interrupt',
          route: 'workflow-execute',
          stage: 'approval-interrupt',
          label: '审批中断',
          owner: 'system',
          status: 'blocked',
          startedAt: '2026-04-07T00:00:01.000Z',
          reason: '等待审批。'
        },
        createdAt: '2026-04-07T00:00:00.000Z',
        updatedAt: '2026-04-07T00:00:01.000Z',
        currentStep: 'waiting_approval',
        retryCount: 0,
        maxRetries: 1
      };
      orchestrator.getTask.mockImplementation((taskId: string) => (taskId === task.id ? task : undefined));
      return task;
    });

    await coordinator.appendMessage(session.id, { message: '继续执行并在需要时审批' });
    await flushAsyncWork();

    const taskListener = orchestrator.subscribe.mock.calls[0]?.[0] as ((task: any) => void) | undefined;
    expect(taskListener).toBeTypeOf('function');

    taskListener?.({
      id: 'task-steps',
      goal: '继续执行并在需要时审批',
      sessionId: session.id,
      status: TaskStatus.RUNNING,
      trace: [],
      approvals: [],
      agentStates: [],
      messages: [],
      executionSteps: [
        {
          id: 'execution_step_workflow-execute_task-planning',
          route: 'workflow-execute',
          stage: 'task-planning',
          label: '任务规划',
          owner: 'libu',
          status: 'completed',
          startedAt: '2026-04-07T00:00:00.000Z',
          completedAt: '2026-04-07T00:00:02.000Z',
          detail: '规划已完成。'
        },
        {
          id: 'execution_step_workflow-execute_approval-interrupt',
          route: 'workflow-execute',
          stage: 'approval-interrupt',
          label: '审批中断',
          owner: 'system',
          status: 'running',
          startedAt: '2026-04-07T00:00:01.000Z',
          detail: '审批通过后恢复。'
        }
      ],
      currentExecutionStep: {
        id: 'execution_step_workflow-execute_approval-interrupt',
        route: 'workflow-execute',
        stage: 'approval-interrupt',
        label: '审批中断',
        owner: 'system',
        status: 'running',
        startedAt: '2026-04-07T00:00:01.000Z',
        detail: '审批通过后恢复。'
      },
      createdAt: '2026-04-07T00:00:00.000Z',
      updatedAt: '2026-04-07T00:00:02.000Z',
      currentStep: 'resume',
      retryCount: 0,
      maxRetries: 1
    });
    await flushAsyncWork();

    const stepEvents = coordinator
      .getEvents(session.id)
      .filter(event => event.type.startsWith('execution_step_'))
      .map(event => ({
        type: event.type,
        stage: event.payload.stage,
        status: event.payload.status
      }));

    expect(stepEvents).toEqual([
      {
        type: 'execution_step_started',
        stage: 'task-planning',
        status: 'running'
      },
      {
        type: 'execution_step_blocked',
        stage: 'approval-interrupt',
        status: 'blocked'
      },
      {
        type: 'execution_step_completed',
        stage: 'task-planning',
        status: 'completed'
      },
      {
        type: 'execution_step_resumed',
        stage: 'approval-interrupt',
        status: 'running'
      }
    ]);
  });

  it('restores persisted execution step checkpoint data after coordinator hydrate', async () => {
    const runtimeRepository = createRuntimeRepository();
    const orchestrator = createOrchestrator();
    const coordinator = new SessionCoordinator(
      orchestrator as never,
      runtimeRepository as never,
      createLlmProvider() as never
    );

    const session = await coordinator.createSession({ title: 'step-restore' });
    await flushAsyncWork();

    orchestrator.createTask.mockImplementationOnce(async dto => {
      const task = {
        id: 'task-restore',
        goal: dto.goal,
        sessionId: dto.sessionId,
        status: TaskStatus.RUNNING,
        trace: [],
        approvals: [],
        agentStates: [],
        messages: [],
        chatRoute: {
          graph: 'workflow',
          flow: 'supervisor',
          reason: 'research_first_prompt',
          adapter: 'research-first',
          priority: 66,
          intent: 'research-first',
          stepsSummary: [
            {
              id: 'execution_step_research-first_request-received',
              route: 'research-first',
              stage: 'request-received',
              label: '接收请求',
              owner: 'session',
              status: 'completed',
              startedAt: '2026-04-07T00:00:00.000Z',
              completedAt: '2026-04-07T00:00:00.000Z',
              detail: '收到用户请求。'
            },
            {
              id: 'execution_step_research-first_route-selection',
              route: 'research-first',
              stage: 'route-selection',
              label: '路由判断',
              owner: 'libu',
              status: 'pending',
              startedAt: ''
            },
            {
              id: 'execution_step_research-first_task-planning',
              route: 'research-first',
              stage: 'task-planning',
              label: '任务规划',
              owner: 'libu',
              status: 'pending',
              startedAt: ''
            },
            {
              id: 'execution_step_research-first_research',
              route: 'research-first',
              stage: 'research',
              label: '研究取证',
              owner: 'hubu',
              status: 'running',
              startedAt: '2026-04-07T00:00:01.000Z',
              detail: '户部正在调研。'
            },
            {
              id: 'execution_step_research-first_delivery',
              route: 'research-first',
              stage: 'delivery',
              label: '交付输出',
              owner: 'libu-docs',
              status: 'pending',
              startedAt: ''
            }
          ]
        },
        executionSteps: [
          {
            id: 'execution_step_research-first_request-received',
            route: 'research-first',
            stage: 'request-received',
            label: '接收请求',
            owner: 'session',
            status: 'completed',
            startedAt: '2026-04-07T00:00:00.000Z',
            completedAt: '2026-04-07T00:00:00.000Z',
            detail: '收到用户请求。'
          },
          {
            id: 'execution_step_research-first_research',
            route: 'research-first',
            stage: 'research',
            label: '研究取证',
            owner: 'hubu',
            status: 'running',
            startedAt: '2026-04-07T00:00:01.000Z',
            detail: '户部正在调研。'
          }
        ],
        currentExecutionStep: {
          id: 'execution_step_research-first_research',
          route: 'research-first',
          stage: 'research',
          label: '研究取证',
          owner: 'hubu',
          status: 'running',
          startedAt: '2026-04-07T00:00:01.000Z',
          detail: '户部正在调研。'
        },
        createdAt: '2026-04-07T00:00:00.000Z',
        updatedAt: '2026-04-07T00:00:01.000Z',
        currentStep: 'research',
        retryCount: 0,
        maxRetries: 1
      };
      orchestrator.getTask.mockImplementation((taskId: string) => (taskId === task.id ? task : undefined));
      return task;
    });

    await coordinator.appendMessage(session.id, { message: '先研究一下这个方案' });
    await flushAsyncWork();

    const rehydrated = new SessionCoordinator(
      orchestrator as never,
      runtimeRepository as never,
      createLlmProvider() as never
    );
    await rehydrated.initialize();

    const restoredCheckpoint = rehydrated.getCheckpoint(session.id);
    expect(restoredCheckpoint?.executionSteps?.map(step => step.stage)).toEqual(['request-received', 'research']);
    expect(restoredCheckpoint?.currentExecutionStep?.stage).toBe('research');
    expect(restoredCheckpoint?.chatRoute?.stepsSummary?.find(step => step.stage === 'research')?.status).toBe(
      'running'
    );
  });
});
