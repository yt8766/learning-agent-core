import {
  DigestGraphStateSchema,
  type DigestGraphState,
  type DigestQueuedDelivery
} from '../schemas/digest-graph-state.schema';

export interface EnqueueDigestDeliveriesNodeInput {
  digestId: string;
  signalId: string;
  now: string;
  matchedRoutes: DigestGraphState['matchedRoutes'];
}

function createDigestDeliveryId(digestId: string, channelTarget: string): string {
  return `delivery_${digestId}_${channelTarget}`;
}

export function enqueueDigestDeliveriesNode(input: EnqueueDigestDeliveriesNodeInput): DigestGraphState {
  const queuedDeliveries: DigestQueuedDelivery[] = [];
  const seenTargets = new Set<string>();

  for (const match of input.matchedRoutes) {
    for (const channelTarget of match.channelTargets) {
      if (seenTargets.has(channelTarget)) {
        continue;
      }

      seenTargets.add(channelTarget);
      queuedDeliveries.push({
        id: createDigestDeliveryId(input.digestId, channelTarget),
        digestId: input.digestId,
        signalId: input.signalId,
        channelType: 'lark',
        channelTarget,
        deliveryKind: 'digest',
        deliveryStatus: 'pending',
        retryCount: 0,
        createdAt: input.now
      });
    }
  }

  return DigestGraphStateSchema.parse({
    mode: 'digest',
    jobId: input.digestId,
    startedAt: input.now,
    digestDate: input.now.slice(0, 10),
    windowStart: input.now,
    windowEnd: input.now,
    queuedDeliveries,
    stats: {
      collectedSignals: 0,
      groupedSignals: 0,
      highlights: 0,
      matchedRoutes: input.matchedRoutes.length,
      queuedDeliveries: queuedDeliveries.length
    }
  });
}
