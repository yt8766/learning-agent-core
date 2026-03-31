import { describe, expect, it, vi } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';

import { RuntimeHost } from '../../src/runtime/core/runtime.host';
import type { RuntimeMessageGatewayFacade } from '../../src/runtime/services/runtime-message-gateway-facade.service';
import { MessageGatewayDeliveryQueueService } from '../../src/message-gateway/message-gateway-delivery-queue.service';
import { MessageGatewayService } from '../../src/message-gateway/message-gateway.service';
import type { GatewayCommandRuntime } from '../../src/message-gateway/message-gateway-commands';

type MessageGatewayRuntimeMock = GatewayCommandRuntime &
  Pick<
    RuntimeMessageGatewayFacade,
    | 'listSessions'
    | 'createSession'
    | 'appendSessionMessage'
    | 'getSessionCheckpoint'
    | 'getSession'
    | 'listSessionMessages'
  >;

const createRuntimeGatewayMock = () =>
  ({
    listSessions: vi.fn(() => []),
    createSession: vi.fn(async dto => ({
      id: 'session-telegram-1',
      title: dto.title,
      status: 'idle',
      channelIdentity: dto.channelIdentity,
      createdAt: '2026-03-27T00:00:00.000Z',
      updatedAt: '2026-03-27T00:00:00.000Z'
    })),
    appendSessionMessage: vi.fn(async () => ({
      id: 'chat-msg-1',
      sessionId: 'session-telegram-1',
      role: 'user',
      content: 'hello',
      createdAt: '2026-03-27T00:00:01.000Z'
    })),
    getSessionCheckpoint: vi.fn(() => ({
      sessionId: 'session-telegram-1',
      taskId: 'task-1',
      graphState: { status: 'running' },
      thinkState: {
        title: '首辅规划',
        content: '先看上下文，再执行。'
      }
    })),
    getSession: vi.fn(() => ({
      id: 'session-telegram-1',
      status: 'running',
      channelIdentity: {
        channel: 'telegram',
        channelChatId: 'chat-1'
      }
    })),
    listSessionMessages: vi.fn(() => [
      {
        id: 'assistant-1',
        role: 'assistant',
        content: '已经完成检索，准备继续执行。'
      }
    ]),
    getTask: vi.fn((taskId: string) => ({
      id: taskId,
      goal: 'demo',
      status: 'completed',
      currentStep: 'review'
    })),
    approveTaskAction: vi.fn(async () => ({ id: 'task-1' })),
    rejectTaskAction: vi.fn(async () => ({ id: 'task-1' })),
    recoverSessionToCheckpoint: vi.fn(async () => ({ id: 'session-telegram-1' }))
  }) as unknown as MessageGatewayRuntimeMock;

const createDeliveryQueueService = () => {
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
  return new MessageGatewayDeliveryQueueService(runtimeHost);
};

describe('MessageGatewayService', () => {
  it('对重复 webhook 做幂等去重', async () => {
    const runtimeDomainService = createRuntimeGatewayMock();
    const service = new MessageGatewayService(runtimeDomainService, createDeliveryQueueService());
    const payload = {
      update_id: 10001,
      message: {
        message_id: 88,
        text: 'hello',
        from: { id: 7, username: 'tester' },
        chat: { id: 42 }
      }
    };

    const first = await service.handleTelegramWebhook(payload);
    const second = await service.handleTelegramWebhook(payload);

    expect(first.deduped).toBeUndefined();
    expect(second.deduped).toBe(true);
    expect(runtimeDomainService.appendSessionMessage).toHaveBeenCalledTimes(1);
  });

  it('会把普通消息聚合成 planning/progress 段落', async () => {
    const runtimeDomainService = createRuntimeGatewayMock();
    const service = new MessageGatewayService(runtimeDomainService, createDeliveryQueueService());

    const result = await service.handleTelegramWebhook({
      update_id: 10002,
      message: {
        message_id: 89,
        text: '继续执行',
        from: { id: 7, username: 'tester' },
        chat: { id: 42 }
      }
    });

    expect(result.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ segment: 'planning' }),
        expect.objectContaining({ segment: 'progress' })
      ])
    );
    expect(result.receipts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ status: 'sent', segment: 'planning' }),
        expect.objectContaining({ status: 'sent', segment: 'progress' })
      ])
    );
    expect(service.listOutboundQueue()).toEqual(expect.arrayContaining(result.receipts ?? []));
  });

  it('配置 telegram secret 后会校验 webhook token', async () => {
    const original = process.env.TELEGRAM_WEBHOOK_SECRET_TOKEN;
    process.env.TELEGRAM_WEBHOOK_SECRET_TOKEN = 'secret-123';
    const runtimeDomainService = createRuntimeGatewayMock();
    const service = new MessageGatewayService(runtimeDomainService, createDeliveryQueueService());

    await expect(
      service.handleTelegramWebhook(
        {
          update_id: 10003,
          message: {
            message_id: 90,
            text: 'hello',
            from: { id: 7, username: 'tester' },
            chat: { id: 42 }
          }
        },
        {
          'x-telegram-bot-api-secret-token': 'bad-token'
        }
      )
    ).rejects.toBeInstanceOf(UnauthorizedException);

    process.env.TELEGRAM_WEBHOOK_SECRET_TOKEN = original;
  });

  it('支持 feishu url_verification challenge 响应', async () => {
    const runtimeDomainService = createRuntimeGatewayMock();
    const service = new MessageGatewayService(runtimeDomainService, createDeliveryQueueService());

    const result = await service.handleFeishuWebhook({
      type: 'url_verification',
      challenge: 'challenge-token'
    });

    expect(result).toEqual({
      challenge: 'challenge-token'
    });
  });

  it('delivery 失败时会记录失败回执并进行一次重试', async () => {
    const original = process.env.TELEGRAM_WEBHOOK_SECRET_TOKEN;
    process.env.TELEGRAM_WEBHOOK_SECRET_TOKEN = 'secret-123';
    const runtimeDomainService = createRuntimeGatewayMock();
    runtimeDomainService.createSession = vi.fn(async dto => ({
      id: 'session-fail-1',
      title: dto.title,
      status: 'idle',
      channelIdentity: {
        channel: 'telegram',
        channelChatId: 'fail-delivery-chat'
      },
      createdAt: '2026-03-27T00:00:00.000Z',
      updatedAt: '2026-03-27T00:00:00.000Z'
    })) as any;
    runtimeDomainService.getSession = vi.fn(() => ({
      id: 'session-fail-1',
      status: 'running',
      channelIdentity: {
        channel: 'telegram',
        channelChatId: 'fail-delivery-chat'
      }
    })) as any;
    const service = new MessageGatewayService(runtimeDomainService, createDeliveryQueueService());

    const result = await service.handleTelegramWebhook(
      {
        update_id: 10004,
        message: {
          message_id: 91,
          text: '继续执行',
          from: { id: 7, username: 'tester' },
          chat: { id: 'fail-delivery-chat' }
        }
      },
      {
        'x-telegram-bot-api-secret-token': 'secret-123'
      }
    );

    expect(result.receipts).toEqual(
      expect.arrayContaining([expect.objectContaining({ status: 'failed', attemptCount: 2 })])
    );
    process.env.TELEGRAM_WEBHOOK_SECRET_TOKEN = original;
  });
});
