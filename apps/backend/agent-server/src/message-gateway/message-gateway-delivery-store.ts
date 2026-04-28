import type { RuntimeStateSnapshot } from '@agent/memory';

import type { ChannelDeliveryReceipt } from './interfaces/message-gateway.interface';

type RuntimeStateRepositoryLike = {
  load: () => Promise<RuntimeStateSnapshot>;
  save: (snapshot: RuntimeStateSnapshot) => Promise<void>;
};

export async function loadChannelDeliveries(runtimeStateRepository: RuntimeStateRepositoryLike) {
  const snapshot = await runtimeStateRepository.load();
  return (snapshot.channelDeliveries ?? []).flatMap(item => {
    if (!isSupportedChannel(item.channel) || !isSupportedSegment(item.segment)) {
      return [];
    }
    return [
      {
        ...item,
        channel: item.channel,
        segment: item.segment
      } satisfies ChannelDeliveryReceipt
    ];
  });
}

export async function saveChannelDeliveries(
  runtimeStateRepository: RuntimeStateRepositoryLike,
  deliveries: ChannelDeliveryReceipt[]
) {
  const snapshot = await runtimeStateRepository.load();
  snapshot.channelDeliveries = deliveries.map(item => ({
    ...item,
    segment: item.segment as unknown as Record<string, unknown>
  }));
  await runtimeStateRepository.save(snapshot);
}

function isSupportedChannel(channel: string): channel is ChannelDeliveryReceipt['channel'] {
  return channel === 'web' || channel === 'telegram' || channel === 'feishu' || channel === 'wechat';
}

function isSupportedSegment(segment: unknown): segment is ChannelDeliveryReceipt['segment'] {
  return segment === 'planning' || segment === 'approval' || segment === 'progress' || segment === 'final';
}
