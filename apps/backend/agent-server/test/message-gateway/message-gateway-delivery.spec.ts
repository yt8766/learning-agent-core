import { describe, expect, it, vi } from 'vitest';

import {
  buildOutboundMessage,
  aggregateOutboundMessages,
  createOutboundReceipts,
  processPendingOutboundReceipts,
  simulateChannelDelivery,
  buildChannelDeliveryHandler
} from '../../src/message-gateway/message-gateway-delivery';
import type { ChannelDeliveryReceipt } from '../../src/message-gateway/interfaces/message-gateway.interface';

describe('buildOutboundMessage', () => {
  it('builds message with identity fields', () => {
    const result = buildOutboundMessage(
      { channel: 'telegram', channelChatId: 'chat-1' },
      'sess-1',
      'task-1',
      'final',
      'Title',
      'Content'
    );

    expect(result.channel).toBe('telegram');
    expect(result.channelChatId).toBe('chat-1');
    expect(result.sessionId).toBe('sess-1');
    expect(result.taskId).toBe('task-1');
    expect(result.segment).toBe('final');
    expect(result.title).toBe('Title');
    expect(result.content).toBe('Content');
    expect(result.createdAt).toBeDefined();
  });

  it('uses defaults when identity is undefined', () => {
    const result = buildOutboundMessage(undefined, 'sess-1', undefined, 'progress', 'T', 'C');

    expect(result.channel).toBe('web');
    expect(result.channelChatId).toBe('sess-1');
    expect(result.taskId).toBeUndefined();
  });
});

describe('aggregateOutboundMessages', () => {
  it('groups messages by segment and preserves order', () => {
    const drafts = [
      { segment: 'progress' as const, title: 'Step 1', content: 'Working...' },
      { segment: 'final' as const, title: 'Done', content: 'Complete' },
      { segment: 'progress' as const, title: 'Step 2', content: 'Still going' }
    ];

    const result = aggregateOutboundMessages(undefined, 'sess-1', 'task-1', drafts);

    expect(result).toHaveLength(2);
    expect(result[0].segment).toBe('progress');
    expect(result[0].content).toContain('Step 1');
    expect(result[0].content).toContain('Step 2');
    expect(result[1].segment).toBe('final');
  });

  it('returns empty array for empty drafts', () => {
    const result = aggregateOutboundMessages(undefined, 'sess-1', undefined, []);

    expect(result).toEqual([]);
  });
});

describe('createOutboundReceipts', () => {
  it('creates receipts from messages', () => {
    const messages = [buildOutboundMessage(undefined, 'sess-1', 'task-1', 'final', 'Title', 'Content')];

    const result = createOutboundReceipts(messages);

    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('queued');
    expect(result[0].sessionId).toBe('sess-1');
    expect(result[0].id).toMatch(/^delivery_/);
  });
});

describe('processPendingOutboundReceipts', () => {
  it('processes queued receipts successfully', async () => {
    const receipt: ChannelDeliveryReceipt = {
      id: 'r-1',
      channel: 'web',
      channelChatId: 'chat-1',
      sessionId: 'sess-1',
      taskId: 'task-1',
      segment: 'final',
      title: 'T',
      content: 'C',
      status: 'queued',
      queuedAt: '2026-05-01T00:00:00.000Z'
    };

    await processPendingOutboundReceipts([receipt], async () => undefined);

    expect(receipt.status).toBe('sent');
    expect(receipt.attemptCount).toBe(1);
    expect(receipt.deliveredAt).toBeDefined();
  });

  it('retries once on failure then marks as failed', async () => {
    const receipt: ChannelDeliveryReceipt = {
      id: 'r-1',
      channel: 'web',
      channelChatId: 'chat-1',
      sessionId: 'sess-1',
      taskId: 'task-1',
      segment: 'final',
      title: 'T',
      content: 'C',
      status: 'queued',
      queuedAt: '2026-05-01T00:00:00.000Z'
    };
    const deliver = vi.fn().mockRejectedValue(new Error('network error'));

    await processPendingOutboundReceipts([receipt], deliver);

    expect(receipt.status).toBe('failed');
    expect(receipt.attemptCount).toBe(2);
    expect(receipt.failureReason).toBe('network error');
    expect(deliver).toHaveBeenCalledTimes(2);
  });

  it('handles non-Error thrown values', async () => {
    const receipt: ChannelDeliveryReceipt = {
      id: 'r-1',
      channel: 'web',
      channelChatId: 'chat-1',
      sessionId: 'sess-1',
      taskId: 'task-1',
      segment: 'final',
      title: 'T',
      content: 'C',
      status: 'queued',
      queuedAt: '2026-05-01T00:00:00.000Z'
    };
    const deliver = vi.fn().mockRejectedValue('string error');

    await processPendingOutboundReceipts([receipt], deliver);

    expect(receipt.status).toBe('failed');
    expect(receipt.failureReason).toBe('channel delivery failed');
  });

  it('skips non-queued receipts', async () => {
    const receipt: ChannelDeliveryReceipt = {
      id: 'r-1',
      channel: 'web',
      channelChatId: 'chat-1',
      sessionId: 'sess-1',
      taskId: 'task-1',
      segment: 'final',
      title: 'T',
      content: 'C',
      status: 'sent',
      queuedAt: '2026-05-01T00:00:00.000Z'
    };
    const deliver = vi.fn();

    await processPendingOutboundReceipts([receipt], deliver);

    expect(deliver).not.toHaveBeenCalled();
  });
});

describe('simulateChannelDelivery', () => {
  it('succeeds for normal chat ids', async () => {
    await expect(
      simulateChannelDelivery({
        id: 'r-1',
        channel: 'web',
        channelChatId: 'normal-chat',
        sessionId: 's-1',
        segment: 'final',
        title: 'T',
        content: 'C',
        status: 'queued',
        queuedAt: '2026-05-01T00:00:00.000Z'
      })
    ).resolves.toBeUndefined();
  });

  it('throws for fail-delivery chat ids', async () => {
    await expect(
      simulateChannelDelivery({
        id: 'r-1',
        channel: 'web',
        channelChatId: 'fail-delivery-chat',
        sessionId: 's-1',
        segment: 'final',
        title: 'T',
        content: 'C',
        status: 'queued',
        queuedAt: '2026-05-01T00:00:00.000Z'
      })
    ).rejects.toThrow('simulated channel delivery failure');
  });
});

describe('buildChannelDeliveryHandler', () => {
  it('returns handler that delegates to simulateChannelDelivery for non-telegram', async () => {
    const handler = buildChannelDeliveryHandler();

    await expect(
      handler({
        id: 'r-1',
        channel: 'web',
        channelChatId: 'chat-1',
        sessionId: 's-1',
        segment: 'final',
        title: 'T',
        content: 'C',
        status: 'queued',
        queuedAt: '2026-05-01T00:00:00.000Z'
      })
    ).resolves.toBeUndefined();
  });

  it('sends via telegram when channel is telegram and token provided', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, result: { message_id: 42 } }),
      text: async () => 'ok'
    });
    const handler = buildChannelDeliveryHandler({
      telegramBotToken: 'bot-token',
      fetchImpl
    });

    const receipt: ChannelDeliveryReceipt = {
      id: 'r-1',
      channel: 'telegram',
      channelChatId: 'chat-123',
      sessionId: 's-1',
      taskId: 't-1',
      segment: 'final',
      title: 'Hello',
      content: 'World',
      status: 'queued',
      queuedAt: '2026-05-01T00:00:00.000Z'
    };

    await handler(receipt);

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://api.telegram.org/botbot-token/sendMessage',
      expect.objectContaining({ method: 'POST' })
    );
    expect(receipt.channelMessageIds).toEqual(['42']);
  });

  it('throws when telegram API returns non-ok response', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => 'Bad Request',
      json: async () => ({})
    });
    const handler = buildChannelDeliveryHandler({
      telegramBotToken: 'bot-token',
      fetchImpl
    });

    const receipt: ChannelDeliveryReceipt = {
      id: 'r-1',
      channel: 'telegram',
      channelChatId: 'chat-123',
      sessionId: 's-1',
      segment: 'final',
      title: 'T',
      content: 'C',
      status: 'queued',
      queuedAt: '2026-05-01T00:00:00.000Z'
    };

    await expect(handler(receipt)).rejects.toThrow('telegram delivery failed: 400');
  });

  it('throws when telegram API returns payload with ok=false', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: false, description: 'chat not found' }),
      text: async () => ''
    });
    const handler = buildChannelDeliveryHandler({
      telegramBotToken: 'bot-token',
      fetchImpl
    });

    const receipt: ChannelDeliveryReceipt = {
      id: 'r-1',
      channel: 'telegram',
      channelChatId: 'chat-123',
      sessionId: 's-1',
      segment: 'final',
      title: 'T',
      content: 'C',
      status: 'queued',
      queuedAt: '2026-05-01T00:00:00.000Z'
    };

    await expect(handler(receipt)).rejects.toThrow('chat not found');
  });

  it('uses custom api base url for telegram', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, result: { message_id: 1 } }),
      text: async () => ''
    });
    const handler = buildChannelDeliveryHandler({
      telegramBotToken: 'token',
      telegramApiBaseUrl: 'https://custom.telegram.api/',
      fetchImpl
    });

    await handler({
      id: 'r-1',
      channel: 'telegram',
      channelChatId: 'c1',
      sessionId: 's-1',
      segment: 'final',
      title: 'T',
      content: 'C',
      status: 'queued',
      queuedAt: '2026-05-01T00:00:00.000Z'
    });

    expect(fetchImpl).toHaveBeenCalledWith('https://custom.telegram.api/bottoken/sendMessage', expect.anything());
  });
});
