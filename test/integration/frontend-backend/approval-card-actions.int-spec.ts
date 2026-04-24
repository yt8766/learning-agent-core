import { describe, expect, it, vi } from 'vitest';

import {
  ChatEventRecordSchema,
  RecoverToCheckpointDtoSchema,
  SessionApprovalDtoSchema,
  SessionCancelDtoSchema,
  type ChatEventRecord,
  type ChatSessionRecord
} from '@agent/core';

import { ChatController } from '../../../apps/backend/agent-server/src/chat/chat.controller';
import { syncSessionFromEvent } from '../../../apps/frontend/agent-chat/src/hooks/chat-session/chat-session-events';
import {
  buildCancelledCheckpointState,
  buildOptimisticControlMessage,
  buildRecoveredCheckpointState
} from '../../../apps/frontend/agent-chat/src/hooks/chat-session/chat-session-control-action-helpers';

function createRequest() {
  return { headers: {} };
}

function createResponse() {
  return { cookie: vi.fn() };
}

function createEvent(overrides: Partial<ChatEventRecord>): ChatEventRecord {
  return ChatEventRecordSchema.parse({
    id: overrides.id ?? `evt-${overrides.type ?? 'approval_required'}`,
    sessionId: overrides.sessionId ?? 'session-approval-action-1',
    type: overrides.type ?? 'approval_required',
    at: overrides.at ?? '2026-04-23T00:00:00.000Z',
    payload: overrides.payload ?? { taskId: 'task-approval-action-1' }
  });
}

function createControllerHarness() {
  const chatService = {
    approve: vi.fn((_sessionId, dto) => SessionApprovalDtoSchema.parse(dto)),
    reject: vi.fn((_sessionId, dto) => SessionApprovalDtoSchema.parse(dto)),
    cancel: vi.fn((_sessionId, dto) => SessionCancelDtoSchema.parse(dto)),
    recover: vi.fn(sessionId => ({ sessionId, recovered: true })),
    recoverToCheckpoint: vi.fn(dto => RecoverToCheckpointDtoSchema.parse(dto))
  };

  return {
    controller: new ChatController(chatService as never),
    chatService
  };
}

describe('approval card actions frontend-backend integration', () => {
  it('keeps approve, reject-with-feedback, cancel, and recover actions aligned with frontend state transitions', () => {
    const { controller, chatService } = createControllerHarness();
    const request = createRequest();
    const response = createResponse();
    const sessionId = 'session-approval-action-1';
    const updatedAt = '2026-04-23T00:00:10.000Z';

    const approveReceipt = controller.approve(request as never, response as never, {
      sessionId,
      intent: 'write_file',
      actor: 'human',
      approvalScope: 'session'
    });
    const rejectReceipt = controller.reject(request as never, response as never, {
      sessionId,
      intent: 'write_file',
      actor: 'human',
      feedback: '先缩小写入范围',
      interrupt: {
        action: 'feedback',
        feedback: '先缩小写入范围'
      }
    });
    const cancelReceipt = controller.cancel(request as never, response as never, {
      sessionId,
      actor: 'human',
      reason: '用户终止当前任务'
    });
    const recoverReceipt = controller.recover(request as never, response as never, { sessionId });
    const checkpointReceipt = controller.recoverToCheckpoint(request as never, response as never, {
      sessionId,
      checkpointId: 'checkpoint-approval-safe',
      checkpointCursor: 4,
      reason: '按反馈恢复到安全检查点'
    });

    expect(approveReceipt).toMatchObject({ sessionId, intent: 'write_file', approvalScope: 'session' });
    expect(rejectReceipt).toMatchObject({
      sessionId,
      feedback: '先缩小写入范围',
      interrupt: { action: 'feedback' }
    });
    expect(cancelReceipt).toMatchObject({ sessionId, reason: '用户终止当前任务' });
    expect(recoverReceipt).toMatchObject({ sessionId, recovered: true });
    expect(checkpointReceipt).toMatchObject({
      sessionId,
      checkpointId: 'checkpoint-approval-safe',
      checkpointCursor: 4
    });
    expect(chatService.approve).toHaveBeenCalledWith(sessionId, expect.objectContaining({ sessionId }));
    expect(chatService.reject).toHaveBeenCalledWith(sessionId, expect.objectContaining({ sessionId }));
    expect(chatService.cancel).toHaveBeenCalledWith(sessionId, expect.objectContaining({ sessionId }));
    expect(response.cookie).toHaveBeenCalledWith('agent_session_id', sessionId, {
      httpOnly: false,
      sameSite: 'lax',
      path: '/'
    });

    let sessions: ChatSessionRecord[] = [
      {
        id: sessionId,
        title: 'approval actions',
        status: 'running',
        createdAt: '2026-04-23T00:00:00.000Z',
        updatedAt: '2026-04-23T00:00:00.000Z'
      }
    ];
    let checkpoint = {
      sessionId,
      taskId: 'task-approval-action-1',
      graphState: { status: 'running', currentStep: 'execute' },
      pendingApprovals: [
        {
          taskId: 'task-approval-action-1',
          intent: 'write_file',
          decision: 'pending',
          decidedAt: '2026-04-23T00:00:00.000Z'
        }
      ],
      thinkState: { title: '等待审批', content: '审批卡片已挂起', loading: false },
      updatedAt: '2026-04-23T00:00:00.000Z'
    };

    for (const event of [
      createEvent({ id: 'evt-approval-required', type: 'approval_required' }),
      createEvent({ id: 'evt-approval-resolved', type: 'approval_resolved' }),
      createEvent({
        id: 'evt-rejected-with-feedback',
        type: 'approval_rejected_with_feedback',
        payload: { taskId: 'task-approval-action-1', feedback: '先缩小写入范围' }
      })
    ]) {
      sessions = syncSessionFromEvent(sessions as never, event as never) as ChatSessionRecord[];
    }

    expect(sessions[0].status).toBe('failed');
    checkpoint = buildCancelledCheckpointState(checkpoint as never, sessionId, updatedAt) as typeof checkpoint;
    expect(checkpoint.graphState).toMatchObject({ status: 'cancelled', currentStep: 'cancelled' });

    checkpoint = buildRecoveredCheckpointState(checkpoint as never, sessionId, updatedAt) as typeof checkpoint;
    expect(checkpoint.graphState).toMatchObject({ status: 'running', currentStep: 'cancelled' });
    expect(checkpoint.thinkState).toMatchObject({ title: '正在恢复执行', loading: true, blink: true });

    expect(buildOptimisticControlMessage(sessionId, '已恢复执行，继续处理').card).toMatchObject({
      type: 'control_notice',
      tone: 'success'
    });
    expect(buildOptimisticControlMessage(sessionId, '本轮已终止：用户终止当前任务').card).toMatchObject({
      type: 'control_notice',
      tone: 'warning'
    });
  });
});
