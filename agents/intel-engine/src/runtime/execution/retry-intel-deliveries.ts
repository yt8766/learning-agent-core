import type { IntelChannelsConfig } from '../../flows/intel/schemas/intel-config.schema';
import { closeExpiredDeliveriesNode } from '../../flows/intel/nodes/close-expired-deliveries';
import { filterRetryableDeliveriesNode } from '../../flows/intel/nodes/filter-retryable-deliveries';
import { loadPendingDeliveriesNode } from '../../flows/intel/nodes/load-pending-deliveries';
import { sendToLarkNode } from '../../flows/intel/nodes/send-to-lark';
import { updateDeliveryStatusNode } from '../../flows/intel/nodes/update-delivery-status';
import type { IntelRetryDeliveryRecord } from '../../flows/intel/schemas/delivery-retry-graph-state.schema';
import { sendLarkWebhookDelivery } from '../../runtime/delivery/lark-webhook-delivery';

export interface RetryIntelDeliveriesInput {
  jobId: string;
  startedAt: string;
  channels: IntelChannelsConfig;
  pendingDeliveries: IntelRetryDeliveryRecord[];
  env?: Record<string, string | undefined>;
  fetchImpl?: typeof fetch;
}

function resolveWebhookUrl(
  channels: IntelChannelsConfig,
  channelTarget: string,
  env: Record<string, string | undefined>
): string | undefined {
  const channel = channels.channels[channelTarget];
  if (!channel?.enabled) {
    return undefined;
  }

  return env[channel.webhookEnv];
}

export async function retryIntelDeliveries(input: RetryIntelDeliveriesInput) {
  const loaded = loadPendingDeliveriesNode({
    jobId: input.jobId,
    startedAt: input.startedAt,
    pendingDeliveries: input.pendingDeliveries
  });
  const retryable = filterRetryableDeliveriesNode(loaded, {
    now: input.startedAt,
    maxRetryCount: 3
  });
  const sent = await sendToLarkNode(retryable, {
    sendDelivery: async delivery => {
      const webhookUrl = resolveWebhookUrl(input.channels, delivery.channelTarget, input.env ?? process.env);
      if (!webhookUrl) {
        return {
          ok: false,
          status: 'failed',
          reason: 'network_error',
          errorMessage: `Missing webhook for channel target: ${delivery.channelTarget}`,
          webhookUrl: ''
        } as const;
      }

      return sendLarkWebhookDelivery({
        webhookUrl,
        payload: {
          msg_type: 'text',
          content: {
            text: `Intel delivery ${delivery.id}`
          }
        },
        fetchImpl: input.fetchImpl
      });
    }
  });
  const updated = updateDeliveryStatusNode(sent, {
    now: input.startedAt
  });

  return closeExpiredDeliveriesNode(updated, {
    now: input.startedAt
  });
}
