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
