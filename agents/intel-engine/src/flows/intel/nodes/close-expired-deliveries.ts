import {
  DeliveryRetryGraphStateSchema,
  type DeliveryRetryGraphState,
  type IntelRetryDeliveryRecord
} from '../schemas/delivery-retry-graph-state.schema';

export interface CloseExpiredDeliveriesNodeInput {
  now: string;
}

function isExpired(delivery: IntelRetryDeliveryRecord, now: string): boolean {
  return delivery.expiresAt !== undefined && delivery.expiresAt <= now;
}

function closeDelivery(delivery: IntelRetryDeliveryRecord): IntelRetryDeliveryRecord {
  return {
    ...delivery,
    deliveryStatus: 'closed'
  };
}

export function closeExpiredDeliveriesNode(
  state: DeliveryRetryGraphState,
  input: CloseExpiredDeliveriesNodeInput
): DeliveryRetryGraphState {
  const closedDeliveries = state.pendingDeliveries
    .filter(delivery => isExpired(delivery, input.now))
    .map(closeDelivery);
  const closedIds = new Set(closedDeliveries.map(delivery => delivery.id));

  return DeliveryRetryGraphStateSchema.parse({
    ...state,
    now: input.now,
    pendingDeliveries: state.pendingDeliveries.map(delivery =>
      closedIds.has(delivery.id) ? closeDelivery(delivery) : delivery
    ),
    retryableDeliveries: state.retryableDeliveries.filter(delivery => !closedIds.has(delivery.id)),
    closedDeliveries: [...state.closedDeliveries, ...closedDeliveries],
    stats: {
      ...state.stats,
      closed: closedDeliveries.length
    }
  });
}
