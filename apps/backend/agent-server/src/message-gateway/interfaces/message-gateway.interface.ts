import { ActionIntent } from '@agent/core';
import type { ChannelIdentity, ChannelOutboundMessage } from '@agent/core';

export interface ChannelDeliveryReceipt {
  id: string;
  channel: ChannelIdentity['channel'];
  channelChatId: string;
  sessionId?: string;
  taskId?: string;
  segment: ChannelOutboundMessage['segment'];
  title?: string;
  content?: string;
  status: 'queued' | 'sent' | 'failed';
  attemptCount?: number;
  queuedAt: string;
  lastAttemptAt?: string;
  deliveredAt?: string;
  failureReason?: string;
  channelMessageIds?: string[];
}

export interface ChannelCommandResult {
  sessionId?: string;
  taskId?: string;
  messages: ChannelOutboundMessage[];
  receipts?: ChannelDeliveryReceipt[];
  deduped?: boolean;
}

export interface ChannelInboundHeaderMap {
  [key: string]: string | string[] | undefined;
}

export interface ParsedGatewayCommand {
  rawCommand: string;
  args: string[];
}

export type ParsedActionIntent = (typeof ActionIntent)[keyof typeof ActionIntent];
