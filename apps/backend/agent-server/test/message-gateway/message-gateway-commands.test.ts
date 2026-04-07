import { describe, expect, it, vi } from 'vitest';
import { ActionIntent, type ChannelOutboundMessage, type InboundChannelMessage } from '@agent/shared';

import { executeGatewayCommand, type GatewayCommandRuntime } from '../../src/message-gateway/message-gateway-commands';

function createRuntime(overrides: Partial<GatewayCommandRuntime> = {}): GatewayCommandRuntime {
  return {
    getSessionCheckpoint: vi.fn(() => ({
      taskId: 'task-1',
      currentMinistry: 'gongbu-code',
      currentNode: 'review'
    })),
    getSession: vi.fn(() => ({
      id: 'session-1',
      status: 'running'
    })),
    getTask: vi.fn((taskId: string) => ({
      id: taskId,
      goal: 'audit current change',
      status: 'completed',
      currentStep: 'review'
    })),
    approveTaskAction: vi.fn(async () => ({ ok: true })),
    rejectTaskAction: vi.fn(async () => ({ ok: true })),
    recoverSessionToCheckpoint: vi.fn(async () => ({ ok: true })),
    ...overrides
  };
}

function createMessage(command: string): InboundChannelMessage {
  return {
    channel: 'telegram',
    channelUserId: 'user-1',
    channelChatId: 'chat-1',
    messageId: 'msg-1',
    text: command,
    command,
    identity: {
      channel: 'telegram',
      channelUserId: 'user-1',
      channelChatId: 'chat-1',
      messageId: 'msg-1',
      displayName: 'tester'
    }
  };
}

function buildOutboundMessage(
  identity: InboundChannelMessage['identity'],
  nextSessionId: string,
  taskId: string | undefined,
  segment: ChannelOutboundMessage['segment'],
  title: string,
  content: string
): ChannelOutboundMessage {
  return {
    channel: identity?.channel ?? 'telegram',
    channelChatId: identity?.channelChatId ?? 'chat-1',
    sessionId: nextSessionId,
    taskId,
    segment,
    title,
    content,
    createdAt: '2026-04-01T00:00:00.000Z'
  };
}

describe('executeGatewayCommand', () => {
  it('renders help and status replies', async () => {
    const runtime = createRuntime();

    const helpResult = await executeGatewayCommand(runtime, 'session-1', createMessage('/help'), buildOutboundMessage);
    const statusResult = await executeGatewayCommand(
      runtime,
      'session-1',
      createMessage('/status'),
      buildOutboundMessage
    );

    expect(helpResult).toEqual({
      messages: [
        expect.objectContaining({
          segment: 'final',
          title: '可用命令',
          content: expect.stringContaining('/approve <taskId> <intent>')
        })
      ]
    });
    expect(statusResult).toEqual({
      taskId: 'task-1',
      messages: [
        expect.objectContaining({
          segment: 'progress',
          title: '会话状态',
          content: ['session: session-1', 'status: running', 'ministry: gongbu-code', 'node: review'].join('\n')
        })
      ]
    });
  });

  it('handles task lookup success and missing task id', async () => {
    const runtime = createRuntime();

    const missingResult = await executeGatewayCommand(
      runtime,
      'session-1',
      createMessage('/task'),
      buildOutboundMessage
    );
    const taskResult = await executeGatewayCommand(
      runtime,
      'session-1',
      createMessage('/task task-9'),
      buildOutboundMessage
    );

    expect(missingResult).toEqual({
      messages: [
        expect.objectContaining({
          segment: 'final',
          title: '缺少 taskId',
          content: '用法：/task <id>'
        })
      ]
    });
    expect(taskResult).toEqual({
      taskId: 'task-9',
      messages: [
        expect.objectContaining({
          segment: 'progress',
          title: '任务摘要',
          content: ['goal: audit current change', 'status: completed', 'step: review'].join('\n')
        })
      ]
    });
    expect(runtime.getTask).toHaveBeenCalledWith('task-9');
  });

  it('approves, rejects, and falls back to the default action intent for unknown intent strings', async () => {
    const runtime = createRuntime();

    const approveMissing = await executeGatewayCommand(
      runtime,
      'session-1',
      createMessage('/approve task-1'),
      buildOutboundMessage
    );
    const approveResult = await executeGatewayCommand(
      runtime,
      'session-1',
      createMessage('/approve task-1 write_file'),
      buildOutboundMessage
    );
    const rejectResult = await executeGatewayCommand(
      runtime,
      'session-1',
      createMessage('/reject task-2 unsupported-intent'),
      buildOutboundMessage
    );

    expect(approveMissing).toEqual({
      messages: [
        expect.objectContaining({
          segment: 'approval',
          title: '缺少参数',
          content: '用法：/approve <taskId> <intent>'
        })
      ]
    });
    expect(runtime.approveTaskAction).toHaveBeenCalledWith(
      'task-1',
      expect.objectContaining({
        intent: ActionIntent.WRITE_FILE,
        actor: 'telegram:user-1',
        reason: 'approved_from_channel'
      })
    );
    expect(runtime.rejectTaskAction).toHaveBeenCalledWith(
      'task-2',
      expect.objectContaining({
        intent: ActionIntent.CALL_EXTERNAL_API,
        actor: 'telegram:user-1',
        reason: 'rejected_from_channel'
      })
    );
    expect(approveResult.messages[0]).toEqual(
      expect.objectContaining({
        title: '审批已通过',
        content: 'task-1 / write_file'
      })
    );
    expect(rejectResult.messages[0]).toEqual(
      expect.objectContaining({
        title: '审批已拒绝',
        content: 'task-2 / call_external_api'
      })
    );
  });

  it('recovers a session and reports unknown commands', async () => {
    const runtime = createRuntime({
      getSessionCheckpoint: vi.fn(() => ({
        taskId: 'task-2'
      }))
    });

    const recoverResult = await executeGatewayCommand(
      runtime,
      'session-1',
      createMessage('/recover session-2'),
      buildOutboundMessage
    );
    const defaultResult = await executeGatewayCommand(
      runtime,
      'session-1',
      createMessage('/something-else'),
      buildOutboundMessage
    );

    expect(runtime.recoverSessionToCheckpoint).toHaveBeenCalledWith({
      sessionId: 'session-2',
      reason: 'recover_from_channel_command'
    });
    expect(recoverResult).toEqual({
      messages: [
        expect.objectContaining({
          sessionId: 'session-2',
          taskId: 'task-2',
          segment: 'final',
          title: '逻辑回溯已完成'
        })
      ]
    });
    expect(defaultResult).toEqual({
      messages: [
        expect.objectContaining({
          segment: 'final',
          title: '未知命令',
          content: '未识别命令：/something-else'
        })
      ]
    });
  });

  it('propagates runtime command failures to the caller', async () => {
    const runtime = createRuntime({
      approveTaskAction: vi.fn(async () => {
        throw new Error('approval downstream failed');
      })
    });

    await expect(
      executeGatewayCommand(runtime, 'session-1', createMessage('/approve task-1 write_file'), buildOutboundMessage)
    ).rejects.toThrow('approval downstream failed');
  });
});
