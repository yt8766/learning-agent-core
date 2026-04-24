import {
  DeliveryRetryGraphStateSchema,
  type DeliveryRetryGraphState,
  type IntelRetryDeliveryRecord
} from '../schemas/delivery-retry-graph-state.schema';

export interface FilterRetryableDeliveriesNodeInput {
  now: string;
  maxRetryCount: number;
}

function isAtOrBefore(left: string | undefined, right: string): boolean {
  return left === undefined || left <= right;
}

function isRetryable(delivery: IntelRetryDeliveryRecord, input: FilterRetryableDeliveriesNodeInput): boolean {
  if (delivery.deliveryStatus === 'closed' || delivery.deliveryStatus === 'sent') {
    return false;
  }

  if (delivery.retryCount >= input.maxRetryCount) {
    return false;
  }

  if (!isAtOrBefore(delivery.nextRetryAt, input.now)) {
    return false;
  }

  if (delivery.expiresAt !== undefined && delivery.expiresAt <= input.now) {
    return false;
  }

  return true;
}

export function filterRetryableDeliveriesNode(
  state: DeliveryRetryGraphState,
  input: FilterRetryableDeliveriesNodeInput
): DeliveryRetryGraphState {
  const retryableDeliveries = state.pendingDeliveries.filter(delivery => isRetryable(delivery, input));

  return DeliveryRetryGraphStateSchema.parse({
    ...state,
    now: input.now,
    retryableDeliveries,
    stats: {
      ...state.stats,
      retryable: retryableDeliveries.length
    }
  });
}
