import {
  DeliveryRetryGraphStateSchema,
  type DeliveryRetryGraphState,
  type IntelRetryDeliveryRecord
} from '../schemas/delivery-retry-graph-state.schema';

export interface UpdateDeliveryStatusNodeInput {
  now: string;
}

function updateDeliveryRecords(
  deliveries: IntelRetryDeliveryRecord[],
  sentDeliveries: IntelRetryDeliveryRecord[],
  failedDeliveries: IntelRetryDeliveryRecord[]
): IntelRetryDeliveryRecord[] {
  const sentById = new Map(sentDeliveries.map(delivery => [delivery.id, delivery]));
  const failedById = new Map(failedDeliveries.map(delivery => [delivery.id, delivery]));

  return deliveries.map(delivery => sentById.get(delivery.id) ?? failedById.get(delivery.id) ?? delivery);
}

export function updateDeliveryStatusNode(
  state: DeliveryRetryGraphState,
  input: UpdateDeliveryStatusNodeInput
): DeliveryRetryGraphState {
  const pendingDeliveries = updateDeliveryRecords(
    state.pendingDeliveries,
    state.sentDeliveries,
    state.failedDeliveries
  );
  const retryableDeliveries = updateDeliveryRecords(
    state.retryableDeliveries,
    state.sentDeliveries,
    state.failedDeliveries
  );

  return DeliveryRetryGraphStateSchema.parse({
    ...state,
    now: input.now,
    pendingDeliveries,
    retryableDeliveries,
    stats: {
      ...state.stats,
      sent: state.sentDeliveries.length,
      failed: state.failedDeliveries.length
    }
  });
}
