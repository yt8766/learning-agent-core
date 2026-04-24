import {
  DeliveryRetryGraphStateSchema,
  type DeliveryRetryGraphState,
  type IntelRetryDeliveryRecord
} from '../schemas/delivery-retry-graph-state.schema';

export interface LoadPendingDeliveriesNodeInput {
  jobId: string;
  startedAt: string;
  pendingDeliveries: IntelRetryDeliveryRecord[];
}

export function loadPendingDeliveriesNode(input: LoadPendingDeliveriesNodeInput): DeliveryRetryGraphState {
  return DeliveryRetryGraphStateSchema.parse({
    jobId: input.jobId,
    startedAt: input.startedAt,
    now: input.startedAt,
    pendingDeliveries: input.pendingDeliveries,
    retryableDeliveries: [],
    sentDeliveries: [],
    failedDeliveries: [],
    closedDeliveries: [],
    stats: {
      loaded: input.pendingDeliveries.length,
      retryable: 0,
      sent: 0,
      failed: 0,
      closed: 0
    }
  });
}
