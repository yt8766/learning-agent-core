import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/adapters/llm/zhipu-provider', () => ({
  ZhipuLlmProvider: class {
    isConfigured() {
      return false;
    }

    async generateText() {
      return '';
    }
  }
}));

import { ActionIntent, TaskStatus } from '@agent/shared';

import { SessionCoordinator } from '../src/session/session-coordinator';
import {
  createLlmProvider,
  createOrchestrator,
  createRuntimeRepository,
  flushAsyncWork
} from './session-coordinator.test.utils';

// task.activeInterrupt remains the persisted 司礼监 / InterruptController projection in session fixtures.
describe('SessionCoordinator approval and recovery flows', () => {
  it('普通聊天会话遇到等待审批时会由后端自动批准，不再停留在 approval_required', async () => {
    const runtimeRepository = createRuntimeRepository();
    const orchestrator = createOrchestrator();
    const coordinator = new SessionCoordinator(
      orchestrator as never,
      runtimeRepository as never,
      createLlmProvider() as never
    );

    const session = await coordinator.createSession({ title: '自动审批默认链路' });
    await flushAsyncWork();

    let waitingTask: any = {
      id: 'task-auto-approval-1',
      goal: '请安全写入本地文件',
      sessionId: session.id,
      status: TaskStatus.WAITING_APPROVAL,
      trace: [],
      approvals: [
        {
          taskId: 'task-auto-approval-1',
          intent: ActionIntent.WRITE_FILE,
          decision: 'pending',
          decidedAt: '2026-03-28T00:00:00.000Z',
          reason: '普通写入请求。'
        }
      ],
      pendingApproval: {
        toolName: 'write_local_file',
        intent: ActionIntent.WRITE_FILE,
        requestedBy: 'gongbu-code',
        riskLevel: 'medium',
        reason: '普通写入请求。',
        reasonCode: 'approved_by_policy',
        preview: [{ label: 'Path', value: 'src/example.ts' }]
      },
      agentStates: [],
      messages: [],
      currentStep: 'approval_gate',
      retryCount: 0,
      maxRetries: 1,
      createdAt: '2026-03-28T00:00:00.000Z',
      updatedAt: '2026-03-28T00:00:00.000Z'
    };
    orchestrator.getTask.mockImplementation((taskId: string) => (waitingTask?.id === taskId ? waitingTask : undefined));
    orchestrator.applyApproval.mockImplementation(async (taskId, dto) => {
      expect(taskId).toBe('task-auto-approval-1');
      expect(dto).toEqual(
        expect.objectContaining({
          intent: ActionIntent.WRITE_FILE,
          actor: 'agent-chat-auto-approve',
          reason: 'agent-chat default auto approval'
        })
      );

      waitingTask = {
        ...waitingTask,
        status: TaskStatus.COMPLETED,
        approvals: [
          ...waitingTask.approvals,
          {
            taskId: 'task-auto-approval-1',
            intent: ActionIntent.WRITE_FILE,
            decision: 'approved',
            actor: 'agent-chat-auto-approve',
            decidedAt: '2026-03-28T00:00:02.000Z',
            reason: 'agent-chat default auto approval'
          }
        ],
        pendingApproval: undefined,
        messages: [
          {
            id: 'task-msg-auto-approval-1',
            taskId: 'task-auto-approval-1',
            from: 'manager',
            to: 'manager',
            type: 'summary',
            content: '已自动完成安全写入。',
            createdAt: '2026-03-28T00:00:02.000Z'
          }
        ],
        result: '已自动完成安全写入。',
        currentStep: 'finish',
        updatedAt: '2026-03-28T00:00:02.000Z'
      };

      return waitingTask;
    });

    const taskListener = (orchestrator.subscribe as any).mock.calls[0]?.[0] as ((task: any) => void) | undefined;
    expect(taskListener).toBeTypeOf('function');

    taskListener?.(waitingTask);
    await flushAsyncWork(8);

    expect(orchestrator.applyApproval).toHaveBeenCalledTimes(1);
    expect(coordinator.getSession(session.id)?.status).toBe('completed');
    expect(coordinator.getCheckpoint(session.id)).toEqual(
      expect.objectContaining({
        taskId: 'task-auto-approval-1',
        pendingApproval: undefined,
        pendingApprovals: [],
        graphState: expect.objectContaining({ status: TaskStatus.COMPLETED })
      })
    );
    expect(coordinator.getMessages(session.id)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: 'assistant',
          content: '已自动完成安全写入。'
        })
      ])
    );
    expect(coordinator.getEvents(session.id)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'approval_resolved',
          payload: expect.objectContaining({
            decision: 'approved',
            actor: 'agent-chat-auto-approve'
          })
        })
      ])
    );
  });

  it('审批通过和恢复会写入会话事件', async () => {
    const runtimeRepository = createRuntimeRepository();
    const orchestrator = createOrchestrator();
    const coordinator = new SessionCoordinator(
      orchestrator as never,
      runtimeRepository as never,
      createLlmProvider() as never
    );
    const session = await coordinator.createSession({ title: '审批恢复', message: '请执行高风险动作' });

    await flushAsyncWork();

    orchestrator.applyApproval.mockResolvedValue({
      id: 'task-1',
      sessionId: session.id,
      status: TaskStatus.COMPLETED,
      trace: [],
      approvals: [],
      agentStates: [],
      messages: [],
      currentStep: 'finish',
      retryCount: 0,
      maxRetries: 1,
      result: 'approved'
    });

    const approved = await coordinator.approve(session.id, {
      actor: 'tester',
      intent: ActionIntent.WRITE_FILE,
      sessionId: session.id
    });

    expect(approved.status).toBe('completed');
    expect(coordinator.getEvents(session.id)).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: 'approval_resolved' })])
    );

    const recovered = await coordinator.recover(session.id);
    expect(recovered.id).toBe(session.id);
    expect(coordinator.getEvents(session.id)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'session_started',
          payload: expect.objectContaining({ recovered: true })
        })
      ])
    );
  });

  it('approve throws when orchestrator returns no task', async () => {
    const runtimeRepository = createRuntimeRepository();
    const orchestrator = createOrchestrator();
    const coordinator = new SessionCoordinator(
      orchestrator as never,
      runtimeRepository as never,
      createLlmProvider() as never
    );
    const session = await coordinator.createSession({ title: 'approve-not-found', message: '请执行高风险动作' });

    await flushAsyncWork();

    orchestrator.applyApproval.mockResolvedValue(undefined);

    await expect(
      coordinator.approve(session.id, {
        actor: 'tester',
        intent: ActionIntent.WRITE_FILE,
        sessionId: session.id
      })
    ).rejects.toThrow('Task task-1 not found');
  });

  it('reject emits feedback-specific events, abort cancellation, and task-not-found errors', async () => {
    const runtimeRepository = createRuntimeRepository();
    const orchestrator = createOrchestrator();
    const coordinator = new SessionCoordinator(
      orchestrator as never,
      runtimeRepository as never,
      createLlmProvider() as never
    );
    const session = await coordinator.createSession({ title: 'reject-flows', message: '请执行高风险动作' });
    await flushAsyncWork();

    let currentTask: any = {
      id: 'task-reject-1',
      sessionId: session.id,
      status: TaskStatus.WAITING_APPROVAL,
      trace: [],
      approvals: [],
      pendingApproval: {
        toolName: 'write_local_file',
        intent: ActionIntent.WRITE_FILE,
        requestedBy: 'gongbu-code'
      },
      activeInterrupt: {
        id: 'interrupt-reject-1',
        status: 'pending',
        mode: 'blocking',
        source: 'graph',
        kind: 'tool-approval',
        intent: ActionIntent.WRITE_FILE,
        toolName: 'write_local_file',
        payload: {
          interactionKind: 'approval'
        },
        createdAt: '2026-04-01T00:00:00.000Z'
      },
      agentStates: [],
      messages: [],
      currentStep: 'approval_gate',
      retryCount: 0,
      maxRetries: 1,
      createdAt: '2026-04-01T00:00:00.000Z',
      updatedAt: '2026-04-01T00:00:00.000Z'
    };
    coordinator.getSession(session.id)!.currentTaskId = currentTask.id;
    orchestrator.getTask.mockImplementation((taskId: string) => (taskId === currentTask.id ? currentTask : undefined));
    orchestrator.applyApproval.mockImplementation(async () => ({
      ...currentTask,
      status: TaskStatus.BLOCKED,
      approvals: [{ decision: 'rejected' }],
      updatedAt: '2026-04-01T00:00:02.000Z'
    }));

    await coordinator.reject(session.id, {
      actor: 'tester',
      intent: ActionIntent.WRITE_FILE,
      sessionId: session.id,
      feedback: '请先补充风险说明'
    });
    expect(coordinator.getEvents(session.id)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'interrupt_rejected_with_feedback',
          payload: expect.objectContaining({
            decision: 'rejected',
            feedback: '请先补充风险说明'
          })
        })
      ])
    );

    currentTask = {
      ...currentTask,
      id: 'task-reject-2',
      status: TaskStatus.CANCELLED,
      activeInterrupt: undefined,
      pendingApproval: {
        toolName: 'run_shell',
        intent: ActionIntent.DELETE_FILE,
        requestedBy: 'bingbu-ops'
      }
    };
    coordinator.getSession(session.id)!.currentTaskId = currentTask.id;
    orchestrator.getTask.mockImplementation((taskId: string) => (taskId === currentTask.id ? currentTask : undefined));
    orchestrator.applyApproval.mockImplementation(async () => ({
      ...currentTask,
      approvals: [{ decision: 'rejected' }],
      updatedAt: '2026-04-01T00:00:03.000Z'
    }));

    await coordinator.reject(session.id, {
      actor: 'tester',
      intent: ActionIntent.DELETE_FILE,
      sessionId: session.id,
      interrupt: {
        action: 'abort'
      } as any
    });
    expect(coordinator.getEvents(session.id)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'run_cancelled',
          payload: expect.objectContaining({
            decision: 'rejected'
          })
        })
      ])
    );

    orchestrator.applyApproval.mockResolvedValue(undefined);
    await expect(
      coordinator.reject(session.id, {
        actor: 'tester',
        intent: ActionIntent.DELETE_FILE,
        sessionId: session.id
      })
    ).rejects.toThrow(`Task ${currentTask.id} not found`);
  });

  it('ignores task/token updates for unknown sessions and auto-approval re-sync falls back when no session task is returned', async () => {
    const runtimeRepository = createRuntimeRepository();
    const orchestrator = createOrchestrator();
    const coordinator = new SessionCoordinator(
      orchestrator as never,
      runtimeRepository as never,
      createLlmProvider() as never
    );
    const session = await coordinator.createSession({ title: 'ignored-updates' });
    await flushAsyncWork();

    const taskListener = (orchestrator.subscribe as any).mock.calls[0]?.[0] as ((task: any) => void) | undefined;
    const tokenListener = (orchestrator.subscribeTokens as any).mock.calls[0]?.[0] as ((task: any) => void) | undefined;

    taskListener?.({
      id: 'task-ignored',
      sessionId: 'missing-session',
      status: TaskStatus.RUNNING
    });
    tokenListener?.({
      taskId: 'task-ignored',
      messageId: 'ignored-message',
      token: 'ignored',
      role: 'assistant',
      createdAt: '2026-04-01T00:00:00.000Z'
    });

    const waitingTask: any = {
      id: 'task-auto-fallback',
      sessionId: session.id,
      status: TaskStatus.WAITING_APPROVAL,
      trace: [],
      approvals: [],
      pendingApproval: {
        toolName: 'write_local_file',
        intent: ActionIntent.WRITE_FILE,
        requestedBy: 'gongbu-code'
      },
      agentStates: [],
      messages: [],
      currentStep: 'approval_gate',
      retryCount: 0,
      maxRetries: 1,
      createdAt: '2026-04-01T00:00:00.000Z',
      updatedAt: '2026-04-01T00:00:00.000Z'
    };
    orchestrator.applyApproval.mockResolvedValue(undefined);
    taskListener?.(waitingTask);
    await flushAsyncWork(6);

    expect(orchestrator.applyApproval).toHaveBeenCalledWith(
      'task-auto-fallback',
      expect.objectContaining({
        actor: 'agent-chat-auto-approve'
      }),
      expect.anything()
    );
    expect(coordinator.getSession(session.id)?.status).toBe('waiting_approval');
    expect(coordinator.getMessages(session.id).some(message => message.id === 'ignored-message')).toBe(false);
  });

  it('session 级审批策略会写入当前会话，并在后续同类高危动作上自动放行', async () => {
    const runtimeRepository = createRuntimeRepository();
    const orchestrator = createOrchestrator();
    const coordinator = new SessionCoordinator(
      orchestrator as never,
      runtimeRepository as never,
      createLlmProvider() as never
    );
    const session = await coordinator.createSession({ title: 'session policy', message: '请更新配置文件' });
    await flushAsyncWork();

    let currentTask: any = {
      id: 'task-session-policy-1',
      sessionId: session.id,
      status: TaskStatus.WAITING_APPROVAL,
      trace: [],
      approvals: [],
      pendingApproval: {
        toolName: 'write_local_file',
        intent: ActionIntent.WRITE_FILE,
        requestedBy: 'gongbu-code',
        riskLevel: 'high',
        reason: '敏感文件写入需要审批。',
        reasonCode: 'requires_approval_destructive'
      },
      activeInterrupt: {
        id: 'interrupt-session-policy-1',
        status: 'pending',
        mode: 'blocking',
        source: 'graph',
        kind: 'tool-approval',
        intent: ActionIntent.WRITE_FILE,
        toolName: 'write_local_file',
        requestedBy: 'gongbu-code',
        payload: {
          riskCode: 'requires_approval_destructive',
          commandPreview: 'Path: .env.local'
        },
        resumeStrategy: 'command',
        createdAt: '2026-04-01T00:00:00.000Z'
      },
      agentStates: [],
      messages: [],
      currentStep: 'approval_gate',
      retryCount: 0,
      maxRetries: 1,
      createdAt: '2026-04-01T00:00:00.000Z',
      updatedAt: '2026-04-01T00:00:00.000Z'
    };

    orchestrator.getTask.mockImplementation((taskId: string) => (taskId === currentTask.id ? currentTask : undefined));
    orchestrator.applyApproval.mockImplementation(async (_taskId, dto) => ({
      ...currentTask,
      status: TaskStatus.COMPLETED,
      pendingApproval: undefined,
      activeInterrupt: undefined,
      approvals: [
        {
          taskId: currentTask.id,
          intent: ActionIntent.WRITE_FILE,
          decision: 'approved',
          actor: dto.actor,
          decidedAt: '2026-04-01T00:00:02.000Z',
          reason: dto.reason
        }
      ],
      updatedAt: '2026-04-01T00:00:02.000Z'
    }));
    coordinator.getSession(session.id)!.currentTaskId = currentTask.id;

    await coordinator.approve(session.id, {
      actor: 'tester',
      intent: ActionIntent.WRITE_FILE,
      sessionId: session.id,
      approvalScope: 'session'
    });

    expect(coordinator.getSession(session.id)?.approvalPolicies?.sessionAllowRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          scope: 'session',
          intent: ActionIntent.WRITE_FILE,
          toolName: 'write_local_file'
        })
      ])
    );

    currentTask = {
      ...currentTask,
      id: 'task-session-policy-2',
      status: TaskStatus.WAITING_APPROVAL,
      pendingApproval: {
        ...currentTask.pendingApproval
      },
      activeInterrupt: {
        ...currentTask.activeInterrupt,
        id: 'interrupt-session-policy-2'
      },
      updatedAt: '2026-04-01T00:00:03.000Z'
    };
    orchestrator.getTask.mockImplementation((taskId: string) => (taskId === currentTask.id ? currentTask : undefined));
    orchestrator.applyApproval.mockImplementation(async (_taskId, dto) => {
      expect(dto.actor).toBe('agent-chat-session-policy');
      return {
        ...currentTask,
        status: TaskStatus.COMPLETED,
        pendingApproval: undefined,
        activeInterrupt: undefined,
        approvals: [],
        updatedAt: '2026-04-01T00:00:04.000Z'
      };
    });

    const taskListener = (orchestrator.subscribe as any).mock.calls[0]?.[0] as ((task: any) => void) | undefined;
    taskListener?.(currentTask);
    await flushAsyncWork(8);

    expect(orchestrator.applyApproval).toHaveBeenCalled();
  });

  it('always 级审批策略会写入 runtime governance store，并跨会话自动放行', async () => {
    const runtimeRepository = createRuntimeRepository();
    const orchestrator = createOrchestrator();
    const coordinator = new SessionCoordinator(
      orchestrator as never,
      runtimeRepository as never,
      createLlmProvider() as never
    );
    const sessionA = await coordinator.createSession({ title: 'always policy a', message: '请删除缓存目录' });
    const sessionB = await coordinator.createSession({ title: 'always policy b', message: '继续后续操作' });
    await flushAsyncWork();

    let currentTask: any = {
      id: 'task-always-policy-1',
      sessionId: sessionA.id,
      status: TaskStatus.WAITING_APPROVAL,
      trace: [],
      approvals: [],
      pendingApproval: {
        toolName: 'run_shell',
        intent: ActionIntent.DELETE_FILE,
        requestedBy: 'bingbu-ops',
        riskLevel: 'critical',
        reason: '删除目录需要审批。',
        reasonCode: 'requires_approval_destructive'
      },
      activeInterrupt: {
        id: 'interrupt-always-policy-1',
        status: 'pending',
        mode: 'blocking',
        source: 'graph',
        kind: 'tool-approval',
        intent: ActionIntent.DELETE_FILE,
        toolName: 'run_shell',
        requestedBy: 'bingbu-ops',
        payload: {
          riskCode: 'requires_approval_destructive',
          commandPreview: 'rm -rf /tmp/runtime-cache'
        },
        resumeStrategy: 'command',
        createdAt: '2026-04-01T00:00:00.000Z'
      },
      agentStates: [],
      messages: [],
      currentStep: 'approval_gate',
      retryCount: 0,
      maxRetries: 1,
      createdAt: '2026-04-01T00:00:00.000Z',
      updatedAt: '2026-04-01T00:00:00.000Z'
    };

    orchestrator.getTask.mockImplementation((taskId: string) => (taskId === currentTask.id ? currentTask : undefined));
    orchestrator.applyApproval.mockImplementation(async () => ({
      ...currentTask,
      status: TaskStatus.COMPLETED,
      pendingApproval: undefined,
      activeInterrupt: undefined,
      approvals: [],
      updatedAt: '2026-04-01T00:00:02.000Z'
    }));
    coordinator.getSession(sessionA.id)!.currentTaskId = currentTask.id;

    await coordinator.approve(sessionA.id, {
      actor: 'tester',
      intent: ActionIntent.DELETE_FILE,
      sessionId: sessionA.id,
      approvalScope: 'always'
    });

    const savedSnapshot = await runtimeRepository.load();
    expect(savedSnapshot.governance?.approvalScopePolicies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          scope: 'always',
          intent: ActionIntent.DELETE_FILE,
          toolName: 'run_shell'
        })
      ])
    );

    currentTask = {
      ...currentTask,
      id: 'task-always-policy-2',
      sessionId: sessionB.id,
      status: TaskStatus.WAITING_APPROVAL,
      activeInterrupt: {
        ...currentTask.activeInterrupt,
        id: 'interrupt-always-policy-2'
      },
      updatedAt: '2026-04-01T00:00:03.000Z'
    };
    orchestrator.getTask.mockImplementation((taskId: string) => (taskId === currentTask.id ? currentTask : undefined));
    orchestrator.applyApproval.mockImplementation(async (_taskId, dto) => {
      expect(dto.actor).toBe('agent-runtime-approval-policy');
      return {
        ...currentTask,
        status: TaskStatus.COMPLETED,
        pendingApproval: undefined,
        activeInterrupt: undefined,
        approvals: [],
        updatedAt: '2026-04-01T00:00:04.000Z'
      };
    });

    const taskListener = (orchestrator.subscribe as any).mock.calls[0]?.[0] as ((task: any) => void) | undefined;
    taskListener?.(currentTask);
    await flushAsyncWork(8);

    expect(orchestrator.applyApproval).toHaveBeenCalled();
  });

  it('reuses existing session and runtime approval policies instead of duplicating records', async () => {
    const runtimeRepository = createRuntimeRepository();
    const orchestrator = createOrchestrator();
    const coordinator = new SessionCoordinator(
      orchestrator as never,
      runtimeRepository as never,
      createLlmProvider() as never
    );
    const session = await coordinator.createSession({ title: 'policy-upsert', message: '请更新配置文件' });
    await flushAsyncWork();

    let currentTask: any = {
      id: 'task-policy-upsert-1',
      sessionId: session.id,
      status: TaskStatus.WAITING_APPROVAL,
      trace: [],
      approvals: [],
      pendingApproval: {
        toolName: 'write_local_file',
        intent: ActionIntent.WRITE_FILE,
        requestedBy: 'gongbu-code',
        riskLevel: 'high',
        reason: '敏感文件写入需要审批。',
        reasonCode: 'requires_approval_destructive'
      },
      activeInterrupt: {
        id: 'interrupt-policy-upsert-1',
        status: 'pending',
        mode: 'blocking',
        source: 'graph',
        kind: 'tool-approval',
        intent: ActionIntent.WRITE_FILE,
        toolName: 'write_local_file',
        requestedBy: 'gongbu-code',
        payload: {
          riskCode: 'requires_approval_destructive',
          commandPreview: 'Path: .env.local'
        },
        resumeStrategy: 'command',
        createdAt: '2026-04-01T00:00:00.000Z'
      },
      agentStates: [],
      messages: [],
      currentStep: 'approval_gate',
      retryCount: 0,
      maxRetries: 1,
      createdAt: '2026-04-01T00:00:00.000Z',
      updatedAt: '2026-04-01T00:00:00.000Z'
    };
    coordinator.getSession(session.id)!.currentTaskId = currentTask.id;
    orchestrator.getTask.mockImplementation((taskId: string) => (taskId === currentTask.id ? currentTask : undefined));
    orchestrator.applyApproval.mockImplementation(async () => ({
      ...currentTask,
      status: TaskStatus.COMPLETED,
      pendingApproval: undefined,
      activeInterrupt: undefined,
      approvals: [],
      updatedAt: '2026-04-01T00:00:02.000Z'
    }));

    await coordinator.approve(session.id, {
      actor: 'tester-a',
      intent: ActionIntent.WRITE_FILE,
      sessionId: session.id,
      approvalScope: 'session'
    });
    const firstSessionPolicy = coordinator.getSession(session.id)?.approvalPolicies?.sessionAllowRules?.[0];

    currentTask = {
      ...currentTask,
      id: 'task-policy-upsert-2',
      activeInterrupt: {
        ...currentTask.activeInterrupt,
        id: 'interrupt-policy-upsert-2'
      }
    };
    coordinator.getSession(session.id)!.currentTaskId = currentTask.id;
    orchestrator.getTask.mockImplementation((taskId: string) => (taskId === currentTask.id ? currentTask : undefined));

    await coordinator.approve(session.id, {
      actor: 'tester-b',
      intent: ActionIntent.WRITE_FILE,
      sessionId: session.id,
      approvalScope: 'session'
    });

    expect(coordinator.getSession(session.id)?.approvalPolicies?.sessionAllowRules).toEqual([
      expect.objectContaining({
        id: firstSessionPolicy?.id,
        actor: 'tester-b',
        toolName: 'write_local_file'
      })
    ]);

    currentTask = {
      ...currentTask,
      id: 'task-policy-upsert-3',
      activeInterrupt: {
        ...currentTask.activeInterrupt,
        id: 'interrupt-policy-upsert-3'
      }
    };
    coordinator.getSession(session.id)!.currentTaskId = currentTask.id;
    orchestrator.getTask.mockImplementation((taskId: string) => (taskId === currentTask.id ? currentTask : undefined));

    await coordinator.approve(session.id, {
      actor: 'tester-c',
      intent: ActionIntent.WRITE_FILE,
      sessionId: session.id,
      approvalScope: 'always'
    });
    const firstRuntimePolicy = (await runtimeRepository.load()).governance?.approvalScopePolicies?.[0];

    currentTask = {
      ...currentTask,
      id: 'task-policy-upsert-4',
      activeInterrupt: {
        ...currentTask.activeInterrupt,
        id: 'interrupt-policy-upsert-4'
      }
    };
    coordinator.getSession(session.id)!.currentTaskId = currentTask.id;
    orchestrator.getTask.mockImplementation((taskId: string) => (taskId === currentTask.id ? currentTask : undefined));

    await coordinator.approve(session.id, {
      actor: 'tester-d',
      intent: ActionIntent.WRITE_FILE,
      sessionId: session.id,
      approvalScope: 'always'
    });

    expect((await runtimeRepository.load()).governance?.approvalScopePolicies).toEqual([
      expect.objectContaining({
        id: firstRuntimePolicy?.id,
        actor: 'tester-d',
        toolName: 'write_local_file'
      })
    ]);
  });

  it('does not persist reusable policies when approvalScope is once', async () => {
    const runtimeRepository = createRuntimeRepository();
    const orchestrator = createOrchestrator();
    const coordinator = new SessionCoordinator(
      orchestrator as never,
      runtimeRepository as never,
      createLlmProvider() as never
    );
    const session = await coordinator.createSession({ title: 'once-scope', message: '请更新配置文件' });
    await flushAsyncWork();

    const currentTask: any = {
      id: 'task-once-scope',
      sessionId: session.id,
      status: TaskStatus.WAITING_APPROVAL,
      trace: [],
      approvals: [],
      pendingApproval: {
        toolName: 'write_local_file',
        intent: ActionIntent.WRITE_FILE,
        requestedBy: 'gongbu-code',
        reasonCode: 'requires_approval_destructive'
      },
      activeInterrupt: {
        id: 'interrupt-once-scope',
        status: 'pending',
        mode: 'blocking',
        source: 'graph',
        kind: 'tool-approval',
        intent: ActionIntent.WRITE_FILE,
        toolName: 'write_local_file',
        requestedBy: 'gongbu-code',
        payload: {
          riskCode: 'requires_approval_destructive',
          commandPreview: 'Path: .env.local'
        },
        createdAt: '2026-04-01T00:00:00.000Z'
      },
      agentStates: [],
      messages: [],
      currentStep: 'approval_gate',
      retryCount: 0,
      maxRetries: 1,
      createdAt: '2026-04-01T00:00:00.000Z',
      updatedAt: '2026-04-01T00:00:00.000Z'
    };
    coordinator.getSession(session.id)!.currentTaskId = currentTask.id;
    orchestrator.getTask.mockImplementation((taskId: string) => (taskId === currentTask.id ? currentTask : undefined));
    orchestrator.applyApproval.mockResolvedValue({
      ...currentTask,
      status: TaskStatus.COMPLETED,
      pendingApproval: undefined,
      activeInterrupt: undefined
    });

    const savesBefore = runtimeRepository.save.mock.calls.length;
    await coordinator.approve(session.id, {
      actor: 'tester',
      intent: ActionIntent.WRITE_FILE,
      sessionId: session.id,
      approvalScope: 'once'
    });

    expect(coordinator.getSession(session.id)?.approvalPolicies?.sessionAllowRules).toBeUndefined();
    const snapshot = await runtimeRepository.load();
    expect(snapshot.governance?.approvalScopePolicies).toBeUndefined();
    expect(runtimeRepository.save.mock.calls.length).toBe(savesBefore + 1);
  });

  it('private policy persistence exits early when task or scope is missing', async () => {
    const runtimeRepository = createRuntimeRepository();
    const orchestrator = createOrchestrator();
    const coordinator = new SessionCoordinator(
      orchestrator as never,
      runtimeRepository as never,
      createLlmProvider() as never
    );
    const session = await coordinator.createSession({ title: 'policy-early-return' });
    await flushAsyncWork();

    const savesBefore = runtimeRepository.save.mock.calls.length;
    await (coordinator as any).persistApprovalScopePolicy(session, undefined, { actor: 'tester' });
    await (coordinator as any).persistApprovalScopePolicy(
      session,
      {
        id: 'task-policy-early-return',
        currentMinistry: 'gongbu-code',
        currentWorker: 'gongbu-code',
        pendingApproval: {
          intent: ActionIntent.WRITE_FILE,
          toolName: 'write_local_file'
        }
      },
      { actor: 'tester' }
    );

    expect(runtimeRepository.save.mock.calls.length).toBe(savesBefore);
  });

  it('private policy helpers fall back to interrupt metadata and preserve ids on duplicate upserts', async () => {
    const runtimeRepository = createRuntimeRepository();
    const orchestrator = createOrchestrator();
    const coordinator = new SessionCoordinator(
      orchestrator as never,
      runtimeRepository as never,
      createLlmProvider() as never
    );
    const session = await coordinator.createSession({ title: 'policy-helper-fallbacks' });
    await flushAsyncWork();

    const interruptOnlyTask: any = {
      id: 'task-policy-helper',
      currentMinistry: 'xingbu-review',
      activeInterrupt: {
        intent: ActionIntent.WRITE_FILE,
        toolName: 'write_local_file',
        requestedBy: 'xingbu-review',
        payload: 'non-object-payload'
      }
    };

    await (coordinator as any).persistApprovalScopePolicy(session, interruptOnlyTask, {
      actor: 'tester-a',
      approvalScope: 'session'
    });
    const firstSessionPolicy = session.approvalPolicies?.sessionAllowRules?.[0];

    await (coordinator as any).persistApprovalScopePolicy(session, interruptOnlyTask, {
      actor: 'tester-b',
      approvalScope: 'session'
    });

    expect(session.approvalPolicies?.sessionAllowRules).toEqual([
      expect.objectContaining({
        id: firstSessionPolicy?.id,
        actor: 'tester-b',
        requestedBy: 'xingbu-review',
        riskCode: undefined,
        commandPreview: undefined
      })
    ]);

    await (coordinator as any).persistApprovalScopePolicy(session, interruptOnlyTask, {
      actor: 'tester-c',
      approvalScope: 'always'
    });
    const firstRuntimePolicy = (await runtimeRepository.load()).governance?.approvalScopePolicies?.[0];

    await (coordinator as any).persistApprovalScopePolicy(session, interruptOnlyTask, {
      actor: 'tester-d',
      approvalScope: 'always'
    });

    expect((await runtimeRepository.load()).governance?.approvalScopePolicies).toEqual([
      expect.objectContaining({
        id: firstRuntimePolicy?.id,
        actor: 'tester-d',
        requestedBy: 'xingbu-review',
        riskCode: undefined,
        commandPreview: undefined
      })
    ]);
  });

  it('policy upserts preserve unrelated records and can fall back requestedBy to currentMinistry', async () => {
    const runtimeRepository = createRuntimeRepository();
    const orchestrator = createOrchestrator();
    const coordinator = new SessionCoordinator(
      orchestrator as never,
      runtimeRepository as never,
      createLlmProvider() as never
    );
    const session = await coordinator.createSession({ title: 'policy-map-fallbacks' });
    await flushAsyncWork();

    const unrelatedSessionPolicy = {
      id: 'session-policy-unrelated',
      scope: 'session',
      status: 'active',
      matchKey: 'other',
      actor: 'seed'
    } as any;
    session.approvalPolicies = {
      sessionAllowRules: [unrelatedSessionPolicy]
    };

    const unrelatedRuntimePolicy = {
      id: 'runtime-policy-unrelated',
      scope: 'always',
      status: 'active',
      matchKey: 'other',
      actor: 'seed'
    } as any;
    await runtimeRepository.save({
      ...(await runtimeRepository.load()),
      governance: {
        approvalScopePolicies: [unrelatedRuntimePolicy]
      }
    });

    const currentMinistryOnlyTask: any = {
      id: 'task-ministry-fallback',
      currentMinistry: 'libu',
      pendingApproval: {
        intent: ActionIntent.WRITE_FILE,
        toolName: 'write_local_file',
        reasonCode: 'requires_approval_destructive'
      }
    };

    await (coordinator as any).persistApprovalScopePolicy(session, currentMinistryOnlyTask, {
      actor: 'tester-session-a',
      approvalScope: 'session'
    });
    await (coordinator as any).persistApprovalScopePolicy(session, currentMinistryOnlyTask, {
      actor: 'tester-runtime-a',
      approvalScope: 'always'
    });
    const sessionPolicyId = session.approvalPolicies?.sessionAllowRules?.find(
      item => item.id !== unrelatedSessionPolicy.id
    )?.id;
    const runtimePolicyId = (await runtimeRepository.load()).governance?.approvalScopePolicies?.find(
      item => item.id !== unrelatedRuntimePolicy.id
    )?.id;

    await (coordinator as any).persistApprovalScopePolicy(session, currentMinistryOnlyTask, {
      actor: 'tester-session-b',
      approvalScope: 'session'
    });
    await (coordinator as any).persistApprovalScopePolicy(session, currentMinistryOnlyTask, {
      actor: 'tester-runtime-b',
      approvalScope: 'always'
    });

    expect(session.approvalPolicies?.sessionAllowRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'session-policy-unrelated'
        }),
        expect.objectContaining({
          id: sessionPolicyId,
          actor: 'tester-session-b',
          requestedBy: 'libu'
        })
      ])
    );
    expect((await runtimeRepository.load()).governance?.approvalScopePolicies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'runtime-policy-unrelated'
        }),
        expect.objectContaining({
          id: runtimePolicyId,
          actor: 'tester-runtime-b',
          requestedBy: 'libu'
        })
      ])
    );
  });

  it('records auto-allow audits for both runtime and session policies', async () => {
    const runtimeRepository = createRuntimeRepository();
    const orchestrator = createOrchestrator();
    const coordinator = new SessionCoordinator(
      orchestrator as never,
      runtimeRepository as never,
      createLlmProvider() as never
    );
    const sessionA = await coordinator.createSession({ title: 'runtime-auto-allow' });
    const sessionB = await coordinator.createSession({ title: 'session-auto-allow' });
    await flushAsyncWork();

    const runtimePolicy = {
      id: 'policy-runtime',
      scope: 'always',
      status: 'active',
      actor: 'tester-runtime',
      sourceDomain: 'gongbu-code',
      approvalScope: 'always',
      matchKey: 'runtime-key',
      intent: ActionIntent.WRITE_FILE,
      toolName: 'write_local_file',
      riskCode: 'requires_approval_destructive',
      requestedBy: 'gongbu-code',
      commandPreview: 'Path: .env.local',
      createdAt: '2026-04-01T00:00:00.000Z',
      updatedAt: '2026-04-01T00:00:00.000Z',
      matchCount: 0
    } as any;
    const sessionPolicy = {
      ...runtimePolicy,
      id: 'policy-session',
      scope: 'session'
    } as any;
    const waitingTask = {
      id: 'task-auto-allow',
      sessionId: sessionA.id,
      status: TaskStatus.WAITING_APPROVAL,
      pendingApproval: {
        intent: ActionIntent.WRITE_FILE
      },
      activeInterrupt: {
        intent: ActionIntent.WRITE_FILE
      }
    } as any;

    await runtimeRepository.save({
      ...(await runtimeRepository.load()),
      governance: {
        approvalScopePolicies: [runtimePolicy]
      }
    });
    coordinator.getSession(sessionB.id)!.approvalPolicies = {
      sessionAllowRules: [sessionPolicy]
    };

    await (coordinator as any).recordPolicyAutoAllow(sessionA, runtimePolicy, waitingTask);
    await (coordinator as any).recordPolicyAutoAllow(sessionB, sessionPolicy, waitingTask);

    const snapshot = await runtimeRepository.load();
    expect(snapshot.governanceAudit).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: 'approval-policy.auto-allowed',
          actor: 'agent-runtime-approval-policy',
          targetId: 'policy-runtime'
        }),
        expect.objectContaining({
          action: 'approval-policy.auto-allowed',
          actor: 'agent-chat-session-policy',
          targetId: 'policy-session'
        })
      ])
    );
    expect(snapshot.governance?.approvalScopePolicies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'policy-runtime',
          matchCount: 1
        })
      ])
    );
    expect(coordinator.getSession(sessionB.id)?.approvalPolicies?.sessionAllowRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'policy-session',
          matchCount: 1
        })
      ])
    );
  });

  it('同一条会话会把审批原因码、审批通过和自动学习确认串成完整事件链', async () => {
    const runtimeRepository = createRuntimeRepository();
    const orchestrator = createOrchestrator();
    const coordinator = new SessionCoordinator(
      orchestrator as never,
      runtimeRepository as never,
      createLlmProvider() as never
    );

    let currentTask: any;
    orchestrator.createTask.mockImplementation(async dto => {
      currentTask = {
        id: 'task-approval-learn-1',
        goal: dto.goal,
        sessionId: dto.sessionId,
        status: TaskStatus.WAITING_APPROVAL,
        trace: [],
        approvals: [
          {
            taskId: 'task-approval-learn-1',
            intent: ActionIntent.WRITE_FILE,
            decision: 'pending',
            decidedAt: '2026-03-22T00:00:00.000Z',
            reason: '敏感文件写入需要人工审批。'
          }
        ],
        pendingApproval: {
          toolName: 'write_local_file',
          intent: ActionIntent.WRITE_FILE,
          requestedBy: 'gongbu-code',
          riskLevel: 'high',
          reason: '敏感文件写入需要人工审批。',
          reasonCode: 'requires_approval_destructive',
          preview: [{ label: 'Path', value: '.env.local' }]
        },
        activeInterrupt: {
          id: 'interrupt-write-file-1',
          status: 'pending',
          mode: 'blocking',
          source: 'graph',
          kind: 'tool-approval',
          intent: ActionIntent.WRITE_FILE,
          toolName: 'write_local_file',
          resumeStrategy: 'command',
          createdAt: '2026-03-22T00:00:00.000Z'
        },
        agentStates: [],
        messages: [],
        currentStep: 'approval_gate',
        retryCount: 0,
        maxRetries: 1,
        createdAt: '2026-03-22T00:00:00.000Z',
        updatedAt: '2026-03-22T00:00:00.000Z'
      };

      return currentTask;
    });
    orchestrator.getTask.mockImplementation((taskId: string) => (currentTask?.id === taskId ? currentTask : undefined));

    const session = await coordinator.createSession({ title: '审批到学习闭环', message: '请更新本地配置文件' });
    await flushAsyncWork();

    expect(coordinator.getSession(session.id)?.status).toBe('waiting_approval');
    expect(coordinator.getEvents(session.id)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'interrupt_pending',
          payload: expect.objectContaining({
            reasonCode: 'requires_approval_destructive',
            toolName: 'write_local_file'
          })
        })
      ])
    );

    orchestrator.applyApproval.mockImplementation(async () => {
      currentTask = {
        ...currentTask,
        status: TaskStatus.COMPLETED,
        approvals: [
          ...currentTask.approvals,
          {
            taskId: 'task-approval-learn-1',
            intent: ActionIntent.WRITE_FILE,
            decision: 'approved',
            actor: 'tester',
            decidedAt: '2026-03-22T00:00:03.000Z',
            reason: '已确认属于安全写入。'
          }
        ],
        activeInterrupt: undefined,
        pendingApproval: undefined,
        messages: [
          {
            id: 'task-msg-approval-learn-1',
            taskId: 'task-approval-learn-1',
            from: 'manager',
            to: 'manager',
            type: 'summary',
            content: '已按你的长期偏好完成安全写入，并保留最终答复。',
            createdAt: '2026-03-22T00:00:02.000Z'
          }
        ],
        result: '已按你的长期偏好完成安全写入，并保留最终答复。',
        learningEvaluation: {
          score: 0.94,
          confidence: 'high',
          notes: ['识别出稳定偏好，可自动沉淀。'],
          recommendedCandidateIds: ['pref-final-answer'],
          autoConfirmCandidateIds: ['pref-final-answer'],
          candidateReasons: ['基于用户稳定表达提取到输出风格偏好'],
          skippedReasons: [],
          conflictDetected: false,
          conflictTargets: [],
          derivedFromLayers: ['session-compression'],
          policyMode: 'profile:personal',
          expertiseSignals: ['domain-expert'],
          sourceSummary: {
            externalSourceCount: 0,
            internalSourceCount: 0,
            reusedMemoryCount: 1,
            reusedRuleCount: 0,
            reusedSkillCount: 0
          }
        },
        learningCandidates: [
          {
            id: 'pref-final-answer',
            taskId: 'task-approval-learn-1',
            type: 'memory',
            summary: '用户偏好主聊天区只显示最终答复',
            status: 'pending_confirmation',
            payload: { id: 'memory-pref-final-answer' },
            createdAt: '2026-03-22T00:00:02.000Z'
          }
        ],
        currentStep: 'finish',
        updatedAt: '2026-03-22T00:00:03.000Z'
      };

      return currentTask;
    });

    const approved = await coordinator.approve(session.id, {
      actor: 'tester',
      intent: ActionIntent.WRITE_FILE,
      sessionId: session.id
    });
    await flushAsyncWork(6);

    expect(approved.status).toBe('completed');
    expect(orchestrator.confirmLearning).toHaveBeenCalledWith('task-approval-learn-1', ['pref-final-answer']);
    expect(coordinator.getSession(session.id)?.status).toBe('completed');
    expect(coordinator.getMessages(session.id)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: 'assistant',
          content: '已按你的长期偏好完成安全写入，并保留最终答复。'
        })
      ])
    );
    expect(coordinator.getCheckpoint(session.id)).toEqual(
      expect.objectContaining({
        taskId: 'task-approval-learn-1',
        pendingApproval: undefined,
        pendingApprovals: [],
        graphState: expect.objectContaining({ status: TaskStatus.COMPLETED }),
        learningEvaluation: expect.objectContaining({
          policyMode: 'profile:personal',
          candidateReasons: ['基于用户稳定表达提取到输出风格偏好']
        })
      })
    );
    expect(coordinator.getEvents(session.id)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'interrupt_pending',
          payload: expect.objectContaining({
            reasonCode: 'requires_approval_destructive'
          })
        }),
        expect.objectContaining({
          type: 'interrupt_resumed',
          payload: expect.objectContaining({
            decision: 'approved',
            intent: ActionIntent.WRITE_FILE
          })
        }),
        expect.objectContaining({
          type: 'learning_confirmed',
          payload: expect.objectContaining({
            autoConfirmed: true,
            candidateIds: ['pref-final-answer']
          })
        })
      ])
    );
  });

  it('手动取消后会保留已经流出的 assistant 内容，而不是在主线程里消失', async () => {
    const runtimeRepository = createRuntimeRepository();
    const orchestrator = createOrchestrator();
    const coordinator = new SessionCoordinator(
      orchestrator as never,
      runtimeRepository as never,
      createLlmProvider() as never
    );

    const session = await coordinator.createSession({ title: '取消保留内容', message: '请继续生成结论' });
    await flushAsyncWork();

    const currentTask: any = {
      id: 'task-cancel-1',
      goal: '生成长回复',
      sessionId: session.id,
      status: TaskStatus.CANCELLED,
      trace: [
        {
          node: 'run_cancelled',
          at: '2026-03-22T00:00:03.000Z',
          summary: '已手动终止当前执行。'
        }
      ],
      approvals: [],
      pendingApproval: undefined,
      pendingAction: undefined,
      agentStates: [],
      messages: [
        {
          id: 'progress_task-cancel-1',
          taskId: 'task-cancel-1',
          from: 'manager',
          to: 'manager',
          type: 'summary_delta',
          content: '这是已经流式返回给用户的前半段内容。\n',
          createdAt: '2026-03-22T00:00:01.000Z'
        }
      ],
      result: '已手动终止当前执行。',
      currentStep: 'cancelled',
      retryCount: 0,
      maxRetries: 1,
      createdAt: '2026-03-22T00:00:00.000Z',
      updatedAt: '2026-03-22T00:00:03.000Z'
    };

    (coordinator as any).syncTask(session.id, currentTask);

    expect(coordinator.getMessages(session.id)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: 'assistant',
          content: '这是已经流式返回给用户的前半段内容。\n'
        })
      ])
    );
  });
});
