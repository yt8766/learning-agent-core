import type { LarkWebhookDeliveryResult } from '../../../runtime/delivery/lark-webhook-delivery';
import {
  DeliveryRetryGraphStateSchema,
  type DeliveryRetryGraphState,
  type IntelRetryDeliveryRecord
} from '../schemas/delivery-retry-graph-state.schema';

export interface SendToLarkNodeInput {
  sendDelivery?: (delivery: IntelRetryDeliveryRecord) => Promise<LarkWebhookDeliveryResult>;
}

function toAttemptedDelivery(
  delivery: IntelRetryDeliveryRecord,
  now: string,
  result: LarkWebhookDeliveryResult
): IntelRetryDeliveryRecord {
  if (result.ok === true) {
    return {
      ...delivery,
      deliveryStatus: 'sent',
      lastAttemptAt: now
    };
  }

  const failureResult = result;

  return {
    ...delivery,
    deliveryStatus: 'failed',
    lastAttemptAt: now,
    failureReason: failureResult.errorMessage
  };
}

export async function sendToLarkNode(
  state: DeliveryRetryGraphState,
  input: SendToLarkNodeInput
): Promise<DeliveryRetryGraphState> {
  const now = state.now ?? state.startedAt;
  const sendDelivery =
    input.sendDelivery ??
    (async () => ({
      ok: false,
      status: 'failed',
      reason: 'network_error' as const,
      errorMessage: 'No Lark delivery sender configured',
      webhookUrl: ''
    }));
  const results = await Promise.all(
    state.retryableDeliveries.map(async delivery => ({
      delivery,
      result: await sendDelivery(delivery)
    }))
  );

  const sentDeliveries: IntelRetryDeliveryRecord[] = [];
  const failedDeliveries: IntelRetryDeliveryRecord[] = [];

  for (const { delivery, result } of results) {
    const attemptedDelivery = toAttemptedDelivery(delivery, now, result);

    if (result.ok) {
      sentDeliveries.push(attemptedDelivery);
    } else {
      failedDeliveries.push(attemptedDelivery);
    }
  }

  return DeliveryRetryGraphStateSchema.parse({
    ...state,
    sentDeliveries,
    failedDeliveries,
    stats: {
      ...state.stats,
      sent: sentDeliveries.length,
      failed: failedDeliveries.length
    }
  });
}
