import { describe, expect, it, vi } from 'vitest';

import { closeExpiredDeliveriesNode } from '../../../src/flows/intel/nodes/close-expired-deliveries';
import { filterRetryableDeliveriesNode } from '../../../src/flows/intel/nodes/filter-retryable-deliveries';
import { loadPendingDeliveriesNode } from '../../../src/flows/intel/nodes/load-pending-deliveries';
import { sendToLarkNode } from '../../../src/flows/intel/nodes/send-to-lark';
import { updateDeliveryStatusNode } from '../../../src/flows/intel/nodes/update-delivery-status';
import { DeliveryRetryGraphStateSchema } from '../../../src/flows/intel/schemas/delivery-retry-graph-state.schema';
import type { LarkWebhookDeliveryResult } from '../../../src/runtime/delivery/lark-webhook-delivery';

describe('delivery retry graph', () => {
  it('loads pending deliveries, filters retryable records, sends them, and updates status in compact state', async () => {
    const state = DeliveryRetryGraphStateSchema.parse(
      loadPendingDeliveriesNode({
        jobId: 'retry_job_001',
        startedAt: '2026-04-23T12:00:00.000Z',
        pendingDeliveries: [
          {
            id: 'delivery_001',
            signalId: 'signal_001',
            channelType: 'lark',
            channelTarget: 'security_alert',
            deliveryKind: 'alert',
            deliveryStatus: 'pending',
            retryCount: 1,
            createdAt: '2026-04-23T11:30:00.000Z',
            nextRetryAt: '2026-04-23T11:59:00.000Z'
          },
          {
            id: 'delivery_002',
            signalId: 'signal_002',
            channelType: 'lark',
            channelTarget: 'digest_frontend',
            deliveryKind: 'digest',
            deliveryStatus: 'pending',
            retryCount: 3,
            createdAt: '2026-04-23T11:30:00.000Z',
            nextRetryAt: '2026-04-23T11:50:00.000Z'
          },
          {
            id: 'delivery_003',
            signalId: 'signal_003',
            channelType: 'lark',
            channelTarget: 'platform_alert',
            deliveryKind: 'alert',
            deliveryStatus: 'pending',
            retryCount: 0,
            createdAt: '2026-04-22T11:30:00.000Z',
            expiresAt: '2026-04-23T11:59:30.000Z',
            nextRetryAt: '2026-04-23T11:45:00.000Z'
          }
        ]
      })
    );

    const retryableState = filterRetryableDeliveriesNode(state, {
      now: '2026-04-23T12:00:00.000Z',
      maxRetryCount: 3
    });

    expect(retryableState.retryableDeliveries.map(delivery => delivery.id)).toEqual(['delivery_001']);

    const sendDelivery = async (): Promise<LarkWebhookDeliveryResult> => {
      return {
        ok: true,
        status: 'sent',
        httpStatus: 200,
        responseText: '{"StatusCode":0}',
        webhookUrl: 'https://example.com/lark/webhook'
      };
    };

    const sentState = await sendToLarkNode(retryableState, {
      sendDelivery: vi.fn(async delivery => {
        if (delivery.id === 'delivery_001') {
          return sendDelivery();
        }

        return {
          ok: false,
          status: 'failed',
          reason: 'http_error',
          httpStatus: 500,
          errorMessage: 'unexpected',
          webhookUrl: 'https://example.com/lark/webhook'
        } satisfies LarkWebhookDeliveryResult;
      })
    });

    const updatedState = updateDeliveryStatusNode(sentState, {
      now: '2026-04-23T12:00:05.000Z'
    });

    const closedState = closeExpiredDeliveriesNode(updatedState, {
      now: '2026-04-23T12:00:05.000Z'
    });

    expect(sentState.sentDeliveries.map(delivery => delivery.id)).toEqual(['delivery_001']);
    expect(updatedState.pendingDeliveries[0]?.deliveryStatus).toBe('sent');
    expect(closedState.closedDeliveries.map(delivery => delivery.id)).toEqual(['delivery_003']);
  });
});
