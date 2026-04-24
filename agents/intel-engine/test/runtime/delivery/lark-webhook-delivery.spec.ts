import { describe, expect, it, vi } from 'vitest';

import { sendLarkWebhookDelivery } from '../../../src/runtime/delivery/lark-webhook-delivery';

describe('sendLarkWebhookDelivery', () => {
  it('returns a structured success result for an accepted webhook response', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => '{"StatusCode":0,"StatusMessage":"ok"}'
    })) as unknown as typeof fetch;

    const result = await sendLarkWebhookDelivery({
      webhookUrl: 'https://example.com/lark/webhook',
      payload: {
        msg_type: 'text',
        content: { text: 'alert' }
      },
      fetchImpl
    });

    expect(result.ok).toBe(true);
    expect(result.status).toBe('sent');
    expect(result.httpStatus).toBe(200);
    expect(result.responseText).toContain('StatusCode');
  });

  it('returns a structured failure result when the webhook is rejected or unavailable', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: false,
      status: 503,
      text: async () => 'service unavailable'
    })) as unknown as typeof fetch;

    const rejected = await sendLarkWebhookDelivery({
      webhookUrl: 'https://example.com/lark/webhook',
      payload: {
        msg_type: 'text',
        content: { text: 'alert' }
      },
      fetchImpl
    });

    const networkFailure = await sendLarkWebhookDelivery({
      webhookUrl: 'https://example.com/lark/webhook',
      payload: {
        msg_type: 'text',
        content: { text: 'alert' }
      },
      fetchImpl: vi.fn(async () => {
        throw new Error('network down');
      }) as unknown as typeof fetch
    });

    expect(rejected.ok).toBe(false);
    if (!rejected.ok) {
      expect(rejected.status).toBe('failed');
      expect(rejected.reason).toBe('http_error');
      expect(rejected.httpStatus).toBe(503);
    }
    if (!networkFailure.ok) {
      expect(networkFailure.reason).toBe('network_error');
      expect(networkFailure.errorMessage).toContain('network down');
    }
  });
});
