import { describe, expect, it } from 'vitest';

import {
  buildCancelledCheckpointState,
  buildOptimisticControlMessage,
  buildRecoveredCheckpointState,
  clearOptimisticThinkingCheckpoint,
  createOptimisticThinkingCheckpoint,
  mapReceiptStatus,
  OPTIMISTIC_CONTROL_MESSAGE_PREFIX
} from '@/hooks/chat-session/chat-session-control-action-helpers';
import type { ChatCheckpointRecord } from '@/types/chat';

describe('chat-session-control-action helpers', () => {
  it('会为当前会话创建 optimistic think checkpoint，并重置审批与中断状态', () => {
    const current: ChatCheckpointRecord = {
      sessionId: 'session-1',
      taskId: 'task-prev',
      traceCursor: 1,
      messageCursor: 2,
      approvalCursor: 3,
      learningCursor: 4,
      pendingApproval: {
        intent: 'run_command',
        toolName: 'terminal',
        requestedBy: 'bingbu',
        requestedAt: '2026-04-08T00:00:00.000Z'
      } as never,
      pendingApprovals: [],
      activeInterrupt: {
        id: 'interrupt-1',
        kind: 'tool-approval',
        status: 'pending',
        mode: 'blocking',
        source: 'tool',
        resumeStrategy: 'command',
        createdAt: '2026-04-08T00:00:00.000Z',
        requestedBy: 'bingbu'
      },
      graphState: { status: 'blocked', currentStep: 'approval_pending' },
      thoughtChain: [{ key: 'step-1', title: 'old step' }],
      agentStates: [],
      createdAt: '2026-04-08T00:00:00.000Z',
      updatedAt: '2026-04-08T00:00:01.000Z'
    };

    const next = createOptimisticThinkingCheckpoint(current, 'session-1', '2026-04-08T00:00:02.000Z', 'pending-1');

    expect(next.taskId).toBe('optimistic_session-1');
    expect(next.pendingApproval).toBeUndefined();
    expect(next.activeInterrupt).toBeUndefined();
    expect(next.graphState).toMatchObject({ status: 'running', currentStep: 'drafting_reply' });
    expect(next.thinkState).toMatchObject({ messageId: 'pending-1', title: '正在准备回复', loading: true });
    expect(next.thoughtChain).toEqual([]);
  });

  it('会为缺失 checkpoint 的新会话创建默认 optimistic state', () => {
    const next = createOptimisticThinkingCheckpoint(undefined, 'session-2', '2026-04-08T00:00:02.000Z');

    expect(next.sessionId).toBe('session-2');
    expect(next.createdAt).toBe('2026-04-08T00:00:02.000Z');
    expect(next.graphState?.status).toBe('running');
    expect(next.taskId).toBe('optimistic_session-2');
  });

  it('会在 optimistic checkpoint 清理时删除临时 checkpoint，并只清理匹配的 thinkState', () => {
    expect(
      clearOptimisticThinkingCheckpoint(
        {
          sessionId: 'session-1',
          taskId: 'optimistic_session-1',
          traceCursor: 0,
          messageCursor: 0,
          approvalCursor: 0,
          learningCursor: 0,
          pendingApprovals: [],
          agentStates: [],
          graphState: { status: 'running' },
          createdAt: '2026-04-08T00:00:00.000Z',
          updatedAt: '2026-04-08T00:00:01.000Z'
        },
        'session-1',
        'pending-1'
      )
    ).toBeUndefined();

    const preserved = clearOptimisticThinkingCheckpoint(
      {
        sessionId: 'session-1',
        taskId: 'task-real',
        traceCursor: 0,
        messageCursor: 0,
        approvalCursor: 0,
        learningCursor: 0,
        pendingApprovals: [],
        agentStates: [],
        graphState: { status: 'running' },
        thinkState: {
          messageId: 'server-msg',
          title: '真实思考',
          content: '内容',
          loading: true,
          blink: true,
          thinkingDurationMs: 100
        },
        createdAt: '2026-04-08T00:00:00.000Z',
        updatedAt: '2026-04-08T00:00:01.000Z'
      },
      'session-1',
      'pending-1'
    );
    expect(preserved?.thinkState?.messageId).toBe('server-msg');
  });

  it('会为取消与恢复构建对应 checkpoint 状态', () => {
    const current: ChatCheckpointRecord = {
      sessionId: 'session-1',
      taskId: 'task-real',
      traceCursor: 0,
      messageCursor: 0,
      approvalCursor: 0,
      learningCursor: 0,
      pendingApprovals: [],
      agentStates: [],
      currentSkillExecution: {
        skillId: 'skill-1',
        displayName: 'repo-inspector',
        title: '扫描仓库',
        phase: 'execute',
        stepIndex: 1,
        totalSteps: 2,
        instruction: 'scan repository',
        updatedAt: '2026-04-08T00:00:01.000Z'
      },
      graphState: { status: 'blocked' },
      thinkState: {
        messageId: 'assistant-1',
        title: '旧思考',
        content: '旧内容',
        loading: true,
        blink: true,
        thinkingDurationMs: 100
      },
      createdAt: '2026-04-08T00:00:00.000Z',
      updatedAt: '2026-04-08T00:00:01.000Z'
    };

    const cancelled = buildCancelledCheckpointState(current, 'session-1', '2026-04-08T00:00:03.000Z');
    expect(cancelled?.graphState).toMatchObject({ status: 'cancelled', currentStep: 'cancelled' });
    expect(cancelled?.thinkState).toBeUndefined();

    const recovered = buildRecoveredCheckpointState(current, 'session-1', '2026-04-08T00:00:04.000Z');
    expect(recovered?.graphState).toMatchObject({ status: 'running', currentStep: 'recovering' });
    expect(recovered?.thinkState?.title).toBe('正在恢复执行');
    expect(recovered?.thinkState?.content).toContain('repo-inspector');
  });

  it('会按内容生成 optimistic control notice，并映射 receipt 状态', () => {
    const recovered = buildOptimisticControlMessage('session-1', '已恢复执行');
    expect(recovered.id).toBe(`${OPTIMISTIC_CONTROL_MESSAGE_PREFIX}session-1`);
    expect(recovered.card).toMatchObject({ type: 'control_notice', tone: 'success', label: '已恢复执行' });

    const cancelled = buildOptimisticControlMessage('session-1', '本轮已终止');
    expect(cancelled.card).toMatchObject({ tone: 'warning', label: '本轮已终止' });

    expect(mapReceiptStatus('approved', 'installing')).toBe('installing');
    expect(mapReceiptStatus('approved', 'approved')).toBe('approved');
    expect(mapReceiptStatus('pending')).toBe('pending');
    expect(mapReceiptStatus('installed')).toBe('installed');
    expect(mapReceiptStatus('failed')).toBe('failed');
    expect(mapReceiptStatus('rejected')).toBe('rejected');
  });
});
