import type { ChannelOutboundMessage, InboundChannelMessage } from '@agent/core';

import { parseActionIntent, parseGatewayCommand } from './message-gateway-normalizer';

export interface GatewayCommandRuntime {
  getSessionCheckpoint: (sessionId: string) => any;
  getSession: (sessionId: string) => any;
  getTask: (taskId: string) => any;
  approveTaskAction: (taskId: string, dto: any) => Promise<any>;
  rejectTaskAction: (taskId: string, dto: any) => Promise<any>;
  recoverSessionToCheckpoint: (dto: any) => Promise<any>;
}

export async function executeGatewayCommand(
  runtimeDomainService: GatewayCommandRuntime,
  sessionId: string,
  message: InboundChannelMessage,
  buildOutboundMessage: (
    identity: InboundChannelMessage['identity'],
    nextSessionId: string,
    taskId: string | undefined,
    segment: ChannelOutboundMessage['segment'],
    title: string,
    content: string
  ) => ChannelOutboundMessage
): Promise<{ taskId?: string; messages: ChannelOutboundMessage[] }> {
  const { rawCommand, args } = parseGatewayCommand(message.command);
  switch (rawCommand) {
    case '/help':
      return {
        messages: [
          buildOutboundMessage(
            message.identity,
            sessionId,
            undefined,
            'final',
            '可用命令',
            [
              '/status',
              '/task <id>',
              '/approve <taskId> <intent>',
              '/reject <taskId> <intent>',
              '/recover <sessionId>'
            ].join('\n')
          )
        ]
      };
    case '/status': {
      const checkpoint = runtimeDomainService.getSessionCheckpoint(sessionId);
      const session = runtimeDomainService.getSession(sessionId);
      return {
        taskId: checkpoint?.taskId,
        messages: [
          buildOutboundMessage(
            message.identity,
            sessionId,
            checkpoint?.taskId,
            'progress',
            '会话状态',
            [
              `session: ${session.id}`,
              `status: ${session.status}`,
              checkpoint?.currentMinistry ? `ministry: ${checkpoint.currentMinistry}` : undefined,
              checkpoint?.currentNode ? `node: ${checkpoint.currentNode}` : undefined
            ]
              .filter(Boolean)
              .join('\n')
          )
        ]
      };
    }
    case '/task': {
      const taskId = args[0];
      if (!taskId) {
        return {
          messages: [
            buildOutboundMessage(message.identity, sessionId, undefined, 'final', '缺少 taskId', '用法：/task <id>')
          ]
        };
      }
      const task = runtimeDomainService.getTask(taskId);
      return {
        taskId,
        messages: [
          buildOutboundMessage(
            message.identity,
            sessionId,
            taskId,
            'progress',
            '任务摘要',
            [`goal: ${task.goal}`, `status: ${task.status}`, `step: ${task.currentStep ?? '-'}`].join('\n')
          )
        ]
      };
    }
    case '/approve':
    case '/reject': {
      const [taskId, intent] = args;
      if (!taskId || !intent) {
        return {
          messages: [
            buildOutboundMessage(
              message.identity,
              sessionId,
              undefined,
              'approval',
              '缺少参数',
              `用法：${rawCommand} <taskId> <intent>`
            )
          ]
        };
      }
      const parsedIntent = parseActionIntent(intent);
      const action =
        rawCommand === '/approve'
          ? runtimeDomainService.approveTaskAction(taskId, {
              intent: parsedIntent,
              actor: `${message.channel}:${message.channelUserId}`,
              reason: 'approved_from_channel'
            })
          : runtimeDomainService.rejectTaskAction(taskId, {
              intent: parsedIntent,
              actor: `${message.channel}:${message.channelUserId}`,
              reason: 'rejected_from_channel'
            });
      await action;
      return {
        taskId,
        messages: [
          buildOutboundMessage(
            message.identity,
            sessionId,
            taskId,
            'approval',
            rawCommand === '/approve' ? '审批已通过' : '审批已拒绝',
            `${taskId} / ${parsedIntent}`
          )
        ]
      };
    }
    case '/recover': {
      const recoverSessionId = args[0] ?? sessionId;
      await runtimeDomainService.recoverSessionToCheckpoint({
        sessionId: recoverSessionId,
        reason: 'recover_from_channel_command'
      });
      return {
        messages: [
          buildOutboundMessage(
            message.identity,
            recoverSessionId,
            runtimeDomainService.getSessionCheckpoint(recoverSessionId)?.taskId,
            'final',
            '逻辑回溯已完成',
            '已恢复到当前 checkpoint，可继续观察或推进。'
          )
        ]
      };
    }
    default:
      return {
        messages: [
          buildOutboundMessage(message.identity, sessionId, undefined, 'final', '未知命令', `未识别命令：${rawCommand}`)
        ]
      };
  }
}
