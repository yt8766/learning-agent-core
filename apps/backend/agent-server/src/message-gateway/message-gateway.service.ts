import { Inject, Injectable } from '@nestjs/common';

import { CreateChatSessionDto, InboundChannelMessage } from '@agent/core';

import {
  RuntimeMessageGatewayFacade,
  RuntimeMessageGatewayFacadeService
} from '../runtime/services/runtime-message-gateway-facade.service';
import { FeishuWebhookDto } from './dto/feishu-webhook.dto';
import { TelegramWebhookDto } from './dto/telegram-webhook.dto';
import { executeGatewayCommand, type GatewayCommandRuntime } from './message-gateway-commands';
import { aggregateOutboundMessages, buildOutboundMessage } from './message-gateway-delivery';
import { MessageGatewayDeliveryQueueService } from './message-gateway-delivery-queue.service';
import type {
  ChannelCommandResult,
  ChannelDeliveryReceipt,
  ChannelInboundHeaderMap
} from './interfaces/message-gateway.interface';
import {
  normalizeFeishuWebhook,
  normalizeTelegramWebhook,
  verifyFeishuWebhook,
  verifyTelegramWebhook
} from './message-gateway-normalizer';

@Injectable()
export class MessageGatewayService {
  private readonly processedInboundMessages = new Map<string, ChannelCommandResult>();

  constructor(
    @Inject(RuntimeMessageGatewayFacadeService)
    private readonly runtimeDomainService: RuntimeMessageGatewayFacade,
    private readonly deliveryQueueService: MessageGatewayDeliveryQueueService
  ) {}

  async handleTelegramWebhook(payload: TelegramWebhookDto, headers?: ChannelInboundHeaderMap) {
    verifyTelegramWebhook(headers);
    return this.handleInboundMessage(normalizeTelegramWebhook(payload));
  }

  async handleFeishuWebhook(payload: FeishuWebhookDto, headers?: ChannelInboundHeaderMap) {
    if (payload.type === 'url_verification' && typeof payload.challenge === 'string') {
      return {
        challenge: payload.challenge
      };
    }
    verifyFeishuWebhook(payload, headers);
    return this.handleInboundMessage(normalizeFeishuWebhook(payload));
  }

  async handleInboundMessage(message: InboundChannelMessage): Promise<ChannelCommandResult> {
    const dedupeKey = [message.channel, message.channelChatId, message.messageId].join(':');
    const cached = this.processedInboundMessages.get(dedupeKey);
    if (cached) {
      return {
        ...cached,
        deduped: true
      };
    }

    const session = await this.findOrCreateSession(message);
    const result = message.command
      ? await this.handleCommand(session.id, message)
      : await this.handleChatMessage(session.id, message);

    this.processedInboundMessages.set(dedupeKey, result);
    return result;
  }

  listOutboundQueue(): ChannelDeliveryReceipt[] {
    return this.deliveryQueueService.list();
  }

  private async handleCommand(sessionId: string, message: InboundChannelMessage): Promise<ChannelCommandResult> {
    const commandResult = await executeGatewayCommand(
      this.runtimeDomainService,
      sessionId,
      message,
      buildOutboundMessage
    );
    return {
      sessionId,
      taskId: commandResult.taskId,
      messages: commandResult.messages,
      receipts: await this.deliveryQueueService.enqueue(commandResult.messages)
    };
  }

  private async handleChatMessage(sessionId: string, message: InboundChannelMessage): Promise<ChannelCommandResult> {
    await this.runtimeDomainService.appendSessionMessage(sessionId, {
      message: message.text,
      channelIdentity: message.identity
    });
    const checkpoint = this.runtimeDomainService.getSessionCheckpoint(sessionId);
    const messages = this.aggregateSessionOutput(sessionId);

    return {
      sessionId,
      taskId: checkpoint?.taskId,
      messages,
      receipts: await this.deliveryQueueService.enqueue(messages)
    };
  }

  private async findOrCreateSession(message: InboundChannelMessage) {
    const existing = this.runtimeDomainService
      .listSessions()
      .find(
        session =>
          session.channelIdentity?.channel === message.channel &&
          session.channelIdentity?.channelChatId === message.channelChatId
      );
    if (existing) {
      return existing;
    }

    const dto: CreateChatSessionDto = {
      title: `${message.channel}:${message.channelChatId}`,
      channelIdentity: message.identity
    };
    return this.runtimeDomainService.createSession(dto);
  }

  private aggregateSessionOutput(sessionId: string) {
    const checkpoint = this.runtimeDomainService.getSessionCheckpoint(sessionId);
    const session = this.runtimeDomainService.getSession(sessionId);
    const drafts: Array<{
      segment: 'planning' | 'approval' | 'progress' | 'final';
      title: string;
      content: string;
    }> = [];

    if (checkpoint?.pendingApproval) {
      drafts.push({
        segment: 'approval',
        title: '需要审批',
        content: checkpoint.pendingApproval.reason ?? checkpoint.pendingApproval.intent
      });
    }

    if (checkpoint?.thinkState?.content) {
      drafts.push({
        segment: 'planning',
        title: checkpoint.thinkState.title,
        content: checkpoint.thinkState.content
      });
    }

    for (const item of this.runtimeDomainService.listSessionMessages(sessionId).slice(-1)) {
      if (item.role !== 'assistant') {
        continue;
      }
      drafts.push({
        segment: checkpoint?.graphState.status === 'completed' ? 'final' : 'progress',
        title: checkpoint?.graphState.status === 'completed' ? '最终结论' : '最新进展',
        content: item.content
      });
    }

    return aggregateOutboundMessages(session.channelIdentity, sessionId, checkpoint?.taskId, drafts);
  }
}

type MessageGatewayRuntime = GatewayCommandRuntime &
  Pick<
    RuntimeMessageGatewayFacade,
    | 'listSessions'
    | 'createSession'
    | 'appendSessionMessage'
    | 'getSessionCheckpoint'
    | 'getSession'
    | 'listSessionMessages'
  >;
