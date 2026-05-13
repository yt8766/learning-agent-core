import { describe, expect, it, vi } from 'vitest';

import { MessageGatewayController } from '../../src/message-gateway/message-gateway.controller';

describe('MessageGatewayController', () => {
  const createController = () => {
    const service = {
      listOutboundQueue: vi.fn().mockReturnValue([{ id: 'msg-1', status: 'sent' }]),
      handleTelegramWebhook: vi.fn().mockReturnValue({ ok: true }),
      handleFeishuWebhook: vi.fn().mockReturnValue({ ok: true })
    };
    return { controller: new MessageGatewayController(service as never), service };
  };

  it('listDeliveries returns outbound queue', () => {
    const { controller, service } = createController();

    const result = controller.listDeliveries();

    expect(result).toEqual([{ id: 'msg-1', status: 'sent' }]);
    expect(service.listOutboundQueue).toHaveBeenCalled();
  });

  it('handleTelegramWebhook delegates to service', () => {
    const { controller, service } = createController();
    const payload = { message: { text: 'hello' } };
    const headers = { 'x-telegram-bot-api-secret-token': 'secret' };

    const result = controller.handleTelegramWebhook(payload as never, headers);

    expect(result).toEqual({ ok: true });
    expect(service.handleTelegramWebhook).toHaveBeenCalledWith(payload, headers);
  });

  it('handleFeishuWebhook delegates to service', () => {
    const { controller, service } = createController();
    const payload = { event: { message: { content: 'hello' } } };
    const headers = {};

    const result = controller.handleFeishuWebhook(payload as never, headers);

    expect(result).toEqual({ ok: true });
    expect(service.handleFeishuWebhook).toHaveBeenCalledWith(payload, headers);
  });
});
