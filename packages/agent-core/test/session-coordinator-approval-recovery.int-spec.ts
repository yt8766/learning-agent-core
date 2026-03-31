import { describe, expect, it } from 'vitest';

import { ActionIntent, TaskStatus } from '@agent/shared';

import { SessionCoordinator } from '../src/session/session-coordinator';
import {
  createLlmProvider,
  createOrchestrator,
  createRuntimeRepository,
  flushAsyncWork
} from './session-coordinator.test.utils';

// task.activeInterrupt remains the persisted 司礼监 / InterruptController projection in session fixtures.
describe('SessionCoordinator approval recovery integration', () => {
  it('keeps approval, recover, and cancel state transitions consistent in one session', async () => {
    const runtimeRepository = createRuntimeRepository();
    const orchestrator = createOrchestrator();
    const coordinator = new SessionCoordinator(
      orchestrator as never,
      runtimeRepository as never,
      createLlmProvider() as never
    );

    const session = await coordinator.createSession({
      title: '审批恢复链路',
      channelIdentity: { channel: 'web', channelChatId: 'thread-approval-recovery-1' }
    });
    await flushAsyncWork();

    const waitingTask = {
      id: 'task-approval-recovery-1',
      goal: '请写入高风险文件',
      sessionId: session.id,
      status: TaskStatus.WAITING_APPROVAL,
      trace: [
        {
          node: 'approval_gate',
          at: '2026-03-28T00:00:00.000Z',
          summary: '执行高风险文件写入前等待人工审批',
          data: { reasonCode: 'requires_approval_destructive' }
        }
      ],
      approvals: [
        {
          taskId: 'task-approval-recovery-1',
          intent: ActionIntent.WRITE_FILE,
          decision: 'pending',
          actor: 'gongbu-code',
          decidedAt: '2026-03-28T00:00:00.000Z',
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
        requestedBy: 'gongbu-code',
        riskLevel: 'high',
        resumeStrategy: 'command',
        createdAt: '2026-03-28T00:00:00.000Z'
      },
      agentStates: [],
      messages: [],
      currentStep: 'approval_gate',
      retryCount: 0,
      maxRetries: 1,
      createdAt: '2026-03-28T00:00:00.000Z',
      updatedAt: '2026-03-28T00:00:00.000Z'
    };

    let currentTask: any = waitingTask;
    orchestrator.getTask.mockImplementation((taskId: string) => (currentTask?.id === taskId ? currentTask : undefined));
    orchestrator.applyApproval.mockImplementation(async (taskId: string, dto: any) => {
      expect(taskId).toBe(waitingTask.id);
      expect(dto).toEqual(
        expect.objectContaining({
          actor: 'tester',
          intent: ActionIntent.WRITE_FILE,
          sessionId: session.id
        })
      );

      currentTask = {
        ...currentTask,
        status: TaskStatus.COMPLETED,
        approvals: [
          ...currentTask.approvals,
          {
            taskId: waitingTask.id,
            intent: ActionIntent.WRITE_FILE,
            decision: 'approved',
            actor: 'tester',
            decidedAt: '2026-03-28T00:00:02.000Z',
            reason: '确认执行'
          }
        ],
        activeInterrupt: undefined,
        pendingApproval: undefined,
        messages: [
          {
            id: 'task-msg-approval-recovery-1',
            taskId: waitingTask.id,
            from: 'manager',
            to: 'manager',
            type: 'summary',
            content: '已完成高风险文件写入。',
            createdAt: '2026-03-28T00:00:02.000Z'
          }
        ],
        result: '已完成高风险文件写入。',
        currentStep: 'finish',
        updatedAt: '2026-03-28T00:00:02.000Z'
      };

      return currentTask;
    });
    orchestrator.cancelTask.mockImplementation(async (_taskId: string, reason?: string) => {
      currentTask = {
        ...currentTask,
        status: TaskStatus.CANCELLED,
        currentStep: 'cancelled',
        result: reason ? `执行已终止：${reason}` : '执行已手动终止。',
        trace: [
          ...currentTask.trace,
          {
            node: 'run_cancelled',
            at: '2026-03-28T00:00:03.000Z',
            summary: reason ? `执行已终止：${reason}` : '执行已手动终止。',
            data: reason ? { reason } : {}
          }
        ],
        updatedAt: '2026-03-28T00:00:03.000Z'
      };
      return currentTask;
    });

    const taskListener = (orchestrator.subscribe as any).mock.calls[0]?.[0] as ((task: any) => void) | undefined;
    expect(taskListener).toBeTypeOf('function');

    taskListener?.(waitingTask);
    await flushAsyncWork();

    expect(coordinator.getSession(session.id)?.status).toBe('waiting_approval');
    expect(coordinator.getEvents(session.id)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'interrupt_pending',
          payload: expect.objectContaining({
            taskId: waitingTask.id,
            intent: ActionIntent.WRITE_FILE,
            reasonCode: 'requires_approval_destructive'
          })
        })
      ])
    );

    await coordinator.approve(session.id, {
      actor: 'tester',
      intent: ActionIntent.WRITE_FILE,
      sessionId: session.id,
      reason: '确认执行'
    } as any);

    expect(coordinator.getSession(session.id)?.status).toBe('completed');
    expect(coordinator.getCheckpoint(session.id)).toEqual(
      expect.objectContaining({
        taskId: waitingTask.id,
        pendingApproval: undefined,
        graphState: expect.objectContaining({ status: TaskStatus.COMPLETED })
      })
    );
    expect(coordinator.getEvents(session.id)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'interrupt_resumed',
          payload: expect.objectContaining({
            decision: 'approved',
            intent: ActionIntent.WRITE_FILE
          })
        })
      ])
    );

    const recovered = await coordinator.recover(session.id);
    expect(recovered.id).toBe(session.id);
    expect(coordinator.getEvents(session.id)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'session_started',
          payload: expect.objectContaining({
            recovered: true,
            taskId: waitingTask.id
          })
        })
      ])
    );

    await coordinator.cancel(session.id, {
      actor: 'tester',
      sessionId: session.id,
      reason: '用户终止本轮执行'
    });

    expect(orchestrator.cancelTask).toHaveBeenCalledWith(waitingTask.id, '用户终止本轮执行');
    expect(coordinator.getSession(session.id)?.status).toBe('cancelled');
    expect(coordinator.getCheckpoint(session.id)).toEqual(
      expect.objectContaining({
        graphState: expect.objectContaining({ status: TaskStatus.CANCELLED })
      })
    );
    expect(coordinator.getEvents(session.id)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'run_cancelled',
          payload: expect.objectContaining({
            taskId: waitingTask.id,
            summary: '执行已终止：用户终止本轮执行'
          })
        })
      ])
    );
    expect(coordinator.getMessages(session.id)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: 'system',
          content: '已终止当前执行：用户终止本轮执行'
        })
      ])
    );
  });
});
