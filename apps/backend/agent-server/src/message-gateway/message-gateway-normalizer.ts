import { UnauthorizedException } from '@nestjs/common';

import { ActionIntent, ChannelIdentity, InboundChannelMessage } from '@agent/core';

import { FeishuWebhookDto } from './dto/feishu-webhook.dto';
import { TelegramWebhookDto } from './dto/telegram-webhook.dto';
import type { ChannelInboundHeaderMap, ParsedGatewayCommand } from './interfaces/message-gateway.interface';

type ActionIntentValue = (typeof ActionIntent)[keyof typeof ActionIntent];

export function parseGatewayCommand(command?: string): ParsedGatewayCommand {
  const [rawCommand, ...args] = (command ?? '').split(/\s+/).filter(Boolean);
  return {
    rawCommand,
    args
  };
}

export function parseActionIntent(intent: string): ActionIntentValue {
  const normalized = intent.toLowerCase();
  const entry = Object.values(ActionIntent).find(value => value === normalized);
  return entry ?? ActionIntent.CALL_EXTERNAL_API;
}

export function verifyTelegramWebhook(headers?: ChannelInboundHeaderMap): void {
  const expectedToken = process.env.TELEGRAM_WEBHOOK_SECRET_TOKEN?.trim();
  if (!expectedToken) {
    return;
  }
  const provided = readHeader(headers, 'x-telegram-bot-api-secret-token');
  if (provided !== expectedToken) {
    throw new UnauthorizedException('Invalid telegram webhook secret token');
  }
}

export function verifyFeishuWebhook(payload: FeishuWebhookDto, headers?: ChannelInboundHeaderMap): void {
  const expectedToken = process.env.FEISHU_WEBHOOK_VERIFICATION_TOKEN?.trim();
  if (expectedToken) {
    const token =
      typeof payload.token === 'string'
        ? payload.token
        : typeof payload.header?.token === 'string'
          ? payload.header.token
          : undefined;
    if (token !== expectedToken) {
      throw new UnauthorizedException('Invalid feishu webhook verification token');
    }
  }

  const expectedSignature = process.env.FEISHU_WEBHOOK_SIGNATURE?.trim();
  if (!expectedSignature) {
    return;
  }
  const provided = readHeader(headers, 'x-lark-signature');
  if (provided !== expectedSignature) {
    throw new UnauthorizedException('Invalid feishu webhook signature');
  }
}

export function normalizeTelegramWebhook(payload: TelegramWebhookDto): InboundChannelMessage {
  const message = payload.message ?? payload.edited_message ?? {};
  const from = message.from ?? {};
  const chat = message.chat ?? {};
  const text = typeof message.text === 'string' ? message.text : '';
  return normalizeInboundMessage('telegram', {
    channelUserId: String(from.id ?? 'unknown'),
    channelChatId: String(chat.id ?? 'unknown'),
    messageId: String(message.message_id ?? payload.update_id ?? Date.now()),
    displayName: typeof from.username === 'string' ? from.username : undefined,
    text
  });
}

export function normalizeFeishuWebhook(payload: FeishuWebhookDto): InboundChannelMessage {
  const event = payload.event ?? {};
  const sender = event.sender ?? {};
  const message = event.message ?? payload.message ?? {};
  const chatId =
    typeof message.chat_id === 'string'
      ? message.chat_id
      : typeof message.chatId === 'string'
        ? message.chatId
        : 'unknown';
  const messageId =
    typeof message.message_id === 'string'
      ? message.message_id
      : typeof message.messageId === 'string'
        ? message.messageId
        : `${Date.now()}`;
  const rawContent = typeof message.content === 'string' ? message.content : '';
  const text = extractFeishuText(rawContent);
  return normalizeInboundMessage('feishu', {
    channelUserId: String(sender.sender_id?.open_id ?? sender.id ?? 'unknown'),
    channelChatId: chatId,
    messageId,
    displayName: typeof sender.sender_type === 'string' ? sender.sender_type : undefined,
    text
  });
}

function normalizeInboundMessage(
  channel: ChannelIdentity['channel'],
  payload: {
    channelUserId: string;
    channelChatId: string;
    messageId: string;
    displayName?: string;
    text: string;
  }
): InboundChannelMessage {
  const trimmedText = payload.text.trim();
  const command = trimmedText.startsWith('/') ? trimmedText : undefined;
  const identity: ChannelIdentity = {
    channel,
    channelUserId: payload.channelUserId,
    channelChatId: payload.channelChatId,
    messageId: payload.messageId,
    displayName: payload.displayName
  };
  return {
    channel,
    channelUserId: payload.channelUserId,
    channelChatId: payload.channelChatId,
    messageId: payload.messageId,
    text: trimmedText,
    command,
    identity
  };
}

function readHeader(headers: ChannelInboundHeaderMap | undefined, name: string): string | undefined {
  if (!headers) {
    return undefined;
  }
  const matched = Object.entries(headers).find(([key]) => key.toLowerCase() === name.toLowerCase())?.[1];
  if (Array.isArray(matched)) {
    return matched[0];
  }
  return matched;
}

function extractFeishuText(content: string): string {
  if (!content) {
    return '';
  }
  try {
    const parsed = JSON.parse(content) as Record<string, unknown>;
    if (typeof parsed.text === 'string') {
      return parsed.text;
    }
  } catch {
    return content;
  }
  return content;
}
