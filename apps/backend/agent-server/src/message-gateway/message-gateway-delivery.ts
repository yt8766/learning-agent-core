import type { ChannelIdentity, ChannelOutboundMessage } from '@agent/core';

import type { ChannelDeliveryReceipt } from './interfaces/message-gateway.interface';

export interface ChannelDeliveryOptions {
  telegramBotToken?: string;
  telegramApiBaseUrl?: string;
  telegramMaxMessageLength?: number;
  fetchImpl?: typeof fetch;
}

export function buildOutboundMessage(
  identity: ChannelIdentity | undefined,
  sessionId: string,
  taskId: string | undefined,
  segment: ChannelOutboundMessage['segment'],
  title: string,
  content: string
): ChannelOutboundMessage {
  return {
    channel: identity?.channel ?? 'web',
    channelChatId: identity?.channelChatId ?? sessionId,
    sessionId,
    taskId,
    segment,
    title,
    content,
    createdAt: new Date().toISOString()
  };
}

export function aggregateOutboundMessages(
  identity: ChannelIdentity | undefined,
  sessionId: string,
  taskId: string | undefined,
  drafts: Array<{ segment: ChannelOutboundMessage['segment']; title: string; content: string }>
): ChannelOutboundMessage[] {
  const grouped = new Map<ChannelOutboundMessage['segment'], Array<{ title: string; content: string }>>();
  for (const draft of drafts) {
    const bucket = grouped.get(draft.segment) ?? [];
    bucket.push(draft);
    grouped.set(draft.segment, bucket);
  }

  return (['planning', 'approval', 'progress', 'final'] as const)
    .filter(segment => grouped.has(segment))
    .map(segment => {
      const bucket = grouped.get(segment)!;
      return buildOutboundMessage(
        identity,
        sessionId,
        taskId,
        segment,
        bucket[0]?.title ?? segment,
        bucket.map(item => `${item.title}\n${item.content}`).join('\n\n')
      );
    });
}

export function createOutboundReceipts(messages: ChannelOutboundMessage[]): ChannelDeliveryReceipt[] {
  return messages.map(message => {
    const queuedAt = new Date().toISOString();
    return {
      id: `delivery_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      channel: message.channel,
      channelChatId: message.channelChatId,
      sessionId: message.sessionId,
      taskId: message.taskId,
      segment: message.segment,
      title: message.title,
      content: message.content,
      status: 'queued',
      queuedAt
    };
  });
}

export async function processPendingOutboundReceipts(
  queue: ChannelDeliveryReceipt[],
  deliver: (receipt: ChannelDeliveryReceipt) => Promise<void>
): Promise<void> {
  for (const receipt of queue) {
    while (receipt.status === 'queued' && (receipt.attemptCount ?? 0) < 2) {
      await deliverReceipt(receipt, deliver);
    }
  }
}

async function deliverReceipt(
  receipt: ChannelDeliveryReceipt,
  deliver: (receipt: ChannelDeliveryReceipt) => Promise<void>
): Promise<void> {
  const now = new Date().toISOString();
  receipt.attemptCount = (receipt.attemptCount ?? 0) + 1;
  receipt.lastAttemptAt = now;
  try {
    await deliver(receipt);
    receipt.status = 'sent';
    receipt.deliveredAt = now;
    receipt.failureReason = undefined;
  } catch (error) {
    receipt.status = 'failed';
    receipt.failureReason = error instanceof Error ? error.message : 'channel delivery failed';
    if ((receipt.attemptCount ?? 0) < 2) {
      receipt.status = 'queued';
    }
  }
}

export async function simulateChannelDelivery(receipt: ChannelDeliveryReceipt): Promise<void> {
  if (receipt.channelChatId.includes('fail-delivery')) {
    throw new Error('simulated channel delivery failure');
  }
}

export function buildChannelDeliveryHandler(options: ChannelDeliveryOptions = {}) {
  const telegramBotToken = options.telegramBotToken?.trim();
  const fetchImpl = options.fetchImpl ?? fetch;

  return async (receipt: ChannelDeliveryReceipt) => {
    if (receipt.channel === 'telegram' && telegramBotToken) {
      await deliverTelegramReceipt(receipt, {
        botToken: telegramBotToken,
        apiBaseUrl: options.telegramApiBaseUrl,
        maxMessageLength: options.telegramMaxMessageLength,
        fetchImpl
      });
      return;
    }

    await simulateChannelDelivery(receipt);
  };
}

async function deliverTelegramReceipt(
  receipt: ChannelDeliveryReceipt,
  options: {
    botToken: string;
    apiBaseUrl?: string;
    maxMessageLength?: number;
    fetchImpl: typeof fetch;
  }
) {
  const baseUrl = (options.apiBaseUrl?.trim() || 'https://api.telegram.org').replace(/\/$/, '');
  const endpoint = `${baseUrl}/bot${options.botToken}/sendMessage`;
  const messageText = [receipt.title, receipt.content].filter(Boolean).join('\n\n').trim();
  const chunks = splitTelegramMessage(messageText, options.maxMessageLength ?? 3500);
  const messageIds: string[] = [];

  for (const chunk of chunks) {
    const response = await options.fetchImpl(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        chat_id: receipt.channelChatId,
        text: chunk,
        disable_web_page_preview: true
      })
    });

    if (!response.ok) {
      const detail = await safeReadResponseText(response);
      throw new Error(`telegram delivery failed: ${response.status}${detail ? ` ${detail}` : ''}`);
    }

    const payload = (await response.json()) as {
      ok?: boolean;
      result?: { message_id?: number | string };
      description?: string;
    };

    if (!payload.ok) {
      throw new Error(payload.description || 'telegram delivery failed');
    }

    const messageId = payload.result?.message_id;
    if (messageId !== undefined) {
      messageIds.push(String(messageId));
    }
  }

  receipt.channelMessageIds = messageIds.length ? messageIds : undefined;
}

function splitTelegramMessage(text: string, maxMessageLength: number) {
  const normalized = text.trim();
  if (!normalized) {
    return [''];
  }
  if (normalized.length <= maxMessageLength) {
    return [normalized];
  }

  const chunks: string[] = [];
  let remaining = normalized;
  while (remaining.length > maxMessageLength) {
    const slice = remaining.slice(0, maxMessageLength);
    const breakIndex = Math.max(slice.lastIndexOf('\n'), slice.lastIndexOf(' '));
    const cut = breakIndex > Math.floor(maxMessageLength * 0.5) ? breakIndex : maxMessageLength;
    chunks.push(remaining.slice(0, cut).trim());
    remaining = remaining.slice(cut).trim();
  }
  if (remaining.length) {
    chunks.push(remaining);
  }
  return chunks;
}

async function safeReadResponseText(response: Response) {
  try {
    return (await response.text()).trim();
  } catch {
    return '';
  }
}
