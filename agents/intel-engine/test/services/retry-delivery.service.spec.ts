import { describe, expect, it, vi } from 'vitest';

import { retryIntelDeliveries } from '../../src/services/retry-delivery.service';

describe('retryIntelDeliveries', () => {
  it('resolves channel webhooks and sends retryable Lark deliveries', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => '{"StatusCode":0}'
    })) as unknown as typeof fetch;

    const result = await retryIntelDeliveries({
      jobId: 'retry_job_001',
      startedAt: '2026-04-24T10:00:00.000Z',
      channels: {
        channels: {
          security_alert: {
            name: '安全告警群',
            type: 'lark_webhook',
            webhookEnv: 'LARK_WEBHOOK_SECURITY_ALERT',
            enabled: true
          }
        }
      },
      pendingDeliveries: [
        {
          id: 'delivery_001',
          signalId: 'signal_001',
          channelType: 'lark',
          channelTarget: 'security_alert',
          deliveryKind: 'alert',
          deliveryStatus: 'pending',
          retryCount: 0,
          createdAt: '2026-04-24T09:30:00.000Z',
          nextRetryAt: '2026-04-24T09:45:00.000Z'
        }
      ],
      env: {
        LARK_WEBHOOK_SECURITY_ALERT: 'https://example.com/lark/webhook'
      },
      fetchImpl
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(result.sentDeliveries).toEqual([
      expect.objectContaining({
        id: 'delivery_001',
        deliveryStatus: 'sent'
      })
    ]);
  });
});
