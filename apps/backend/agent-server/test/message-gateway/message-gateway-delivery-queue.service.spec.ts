import { describe, expect, it, vi } from 'vitest';

import { RuntimeHost } from '../../src/runtime/core/runtime.host';
import { MessageGatewayDeliveryQueueService } from '../../src/message-gateway/message-gateway-delivery-queue.service';

describe('MessageGatewayDeliveryQueueService', () => {
  it('入队后会尝试投递，并保留最近回执', async () => {
    const runtimeHost = {
      runtimeStateRepository: {
        load: async () => ({
          tasks: [],
          learningJobs: [],
          pendingExecutions: [],
          channelDeliveries: [],
          chatSessions: [],
          chatMessages: [],
          chatEvents: [],
          chatCheckpoints: [],
          governance: {},
          governanceAudit: [],
          usageHistory: [],
          evalHistory: [],
          usageAudit: []
        }),
        save: async () => undefined
      }
    } as unknown as RuntimeHost;
    const service = new MessageGatewayDeliveryQueueService(runtimeHost);
    await service.onModuleInit();

    const receipts = await service.enqueue([
      {
        channel: 'telegram',
        channelChatId: 'chat-1',
        sessionId: 'session-1',
        taskId: 'task-1',
        segment: 'progress',
        title: '最新进展',
        content: '继续执行',
        createdAt: '2026-03-27T00:00:00.000Z'
      }
    ]);

    expect(receipts).toEqual([expect.objectContaining({ status: 'sent', attemptCount: 1, segment: 'progress' })]);
    expect(service.list()).toEqual(expect.arrayContaining(receipts));
  });

  it('投递失败时会重试一次并留下 failed 回执', async () => {
    const runtimeHost = {
      runtimeStateRepository: {
        load: async () => ({
          tasks: [],
          learningJobs: [],
          pendingExecutions: [],
          channelDeliveries: [],
          chatSessions: [],
          chatMessages: [],
          chatEvents: [],
          chatCheckpoints: [],
          governance: {},
          governanceAudit: [],
          usageHistory: [],
          evalHistory: [],
          usageAudit: []
        }),
        save: async () => undefined
      }
    } as unknown as RuntimeHost;
    const service = new MessageGatewayDeliveryQueueService(runtimeHost);
    await service.onModuleInit();

    const receipts = await service.enqueue([
      {
        channel: 'telegram',
        channelChatId: 'fail-delivery-chat',
        sessionId: 'session-1',
        taskId: 'task-1',
        segment: 'final',
        title: '最终结论',
        content: '失败模拟',
        createdAt: '2026-03-27T00:00:00.000Z'
      }
    ]);

    expect(receipts).toEqual([
      expect.objectContaining({
        status: 'failed',
        attemptCount: 2,
        failureReason: 'simulated channel delivery failure'
      })
    ]);
    expect(service.list()[0]).toEqual(expect.objectContaining({ status: 'failed', attemptCount: 2 }));
  });

  it('模块初始化时会恢复持久化 delivery 队列', async () => {
    const load = vi.fn(async () => ({
      tasks: [],
      learningJobs: [],
      pendingExecutions: [],
      channelDeliveries: [
        {
          id: 'delivery-1',
          channel: 'telegram',
          channelChatId: 'chat-1',
          sessionId: 'session-1',
          taskId: 'task-1',
          segment: 'progress',
          status: 'queued',
          queuedAt: '2026-03-27T00:00:00.000Z'
        }
      ],
      chatSessions: [],
      chatMessages: [],
      chatEvents: [],
      chatCheckpoints: [],
      governance: {},
      governanceAudit: [],
      usageHistory: [],
      evalHistory: [],
      usageAudit: []
    }));
    const save = vi.fn(async () => undefined);
    const runtimeHost = {
      runtimeStateRepository: { load, save }
    } as unknown as RuntimeHost;
    const service = new MessageGatewayDeliveryQueueService(runtimeHost);

    await service.onModuleInit();

    expect(service.list()).toEqual([
      expect.objectContaining({
        id: 'delivery-1',
        status: 'sent',
        attemptCount: 1
      })
    ]);
    expect(save).toHaveBeenCalled();
  });

  it('配置 telegram bot token 后会走真实 telegram sender 并记录 message id', async () => {
    const originalToken = process.env.TELEGRAM_BOT_TOKEN;
    const originalFetch = global.fetch;
    process.env.TELEGRAM_BOT_TOKEN = 'bot-token';
    global.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        ok: true,
        result: {
          message_id: 7788
        }
      })
    })) as unknown as typeof fetch;

    const runtimeHost = {
      runtimeStateRepository: {
        load: async () => ({
          tasks: [],
          learningJobs: [],
          pendingExecutions: [],
          channelDeliveries: [],
          chatSessions: [],
          chatMessages: [],
          chatEvents: [],
          chatCheckpoints: [],
          governance: {},
          governanceAudit: [],
          usageHistory: [],
          evalHistory: [],
          usageAudit: []
        }),
        save: async () => undefined
      }
    } as unknown as RuntimeHost;
    const service = new MessageGatewayDeliveryQueueService(runtimeHost);
    await service.onModuleInit();

    const receipts = await service.enqueue([
      {
        channel: 'telegram',
        channelChatId: 'chat-telegram-real',
        sessionId: 'session-1',
        taskId: 'task-1',
        segment: 'final',
        title: '最终结论',
        content: '已真实回传 Telegram',
        createdAt: '2026-03-27T00:00:00.000Z'
      }
    ]);

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(receipts[0]).toEqual(
      expect.objectContaining({
        status: 'sent',
        channelMessageIds: ['7788']
      })
    );

    process.env.TELEGRAM_BOT_TOKEN = originalToken;
    global.fetch = originalFetch;
  });
});
