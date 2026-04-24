import type { IntelRouteMatch } from '../../../runtime/routing/intel-route-matcher';

export interface IntelQueuedDelivery {
  id: string;
  signalId: string;
  routeId: string;
  channelTarget: string;
  deliveryKind: 'alert' | 'digest';
  deliveryStatus: 'pending';
  retryCount: number;
  createdAt: string;
}

export interface EnqueueDeliveriesNodeInput {
  signalId: string;
  now: string;
  routes: IntelRouteMatch[];
  existingDeliveries?: Pick<
    IntelQueuedDelivery,
    'id' | 'signalId' | 'channelTarget' | 'deliveryKind' | 'deliveryStatus' | 'createdAt'
  >[];
  suppressDuplicateHours: number;
}

export interface EnqueueDeliveriesNodeResult {
  queuedDeliveries: IntelQueuedDelivery[];
  skippedTargets: string[];
}

function createDeliveryId(signalId: string, routeId: string, channelTarget: string): string {
  return `delivery_${signalId}_${routeId}_${channelTarget}`;
}

function createQueuedDelivery(
  signalId: string,
  route: IntelRouteMatch,
  channelTarget: string,
  now: string
): IntelQueuedDelivery {
  return {
    id: createDeliveryId(signalId, route.ruleId, channelTarget),
    signalId,
    routeId: route.ruleId,
    channelTarget,
    deliveryKind: 'alert',
    deliveryStatus: 'pending',
    retryCount: 0,
    createdAt: now
  };
}

function isRecentDuplicate(
  delivery: Pick<IntelQueuedDelivery, 'signalId' | 'channelTarget' | 'deliveryKind' | 'createdAt'>,
  signalId: string,
  channelTarget: string,
  deliveryKind: 'alert' | 'digest',
  now: string,
  suppressDuplicateHours: number
): boolean {
  if (
    delivery.signalId !== signalId ||
    delivery.channelTarget !== channelTarget ||
    delivery.deliveryKind !== deliveryKind
  ) {
    return false;
  }

  const windowStart = Date.parse(now) - suppressDuplicateHours * 60 * 60 * 1000;
  return Date.parse(delivery.createdAt) >= windowStart;
}

export function enqueueDeliveriesNode(input: EnqueueDeliveriesNodeInput): EnqueueDeliveriesNodeResult {
  const queuedDeliveries: IntelQueuedDelivery[] = [];
  const skippedTargets = new Set<string>();
  const existingDeliveries = input.existingDeliveries ?? [];
  const seenTargets = new Set<string>();

  for (const route of input.routes) {
    for (const channelTarget of route.sendTo) {
      if (seenTargets.has(channelTarget)) {
        continue;
      }

      seenTargets.add(channelTarget);

      const hasRecentDuplicate = existingDeliveries.some(delivery =>
        isRecentDuplicate(delivery, input.signalId, channelTarget, 'alert', input.now, input.suppressDuplicateHours)
      );

      if (hasRecentDuplicate) {
        skippedTargets.add(channelTarget);
        continue;
      }

      queuedDeliveries.push(createQueuedDelivery(input.signalId, route, channelTarget, input.now));
    }
  }

  return {
    queuedDeliveries,
    skippedTargets: [...skippedTargets]
  };
}
