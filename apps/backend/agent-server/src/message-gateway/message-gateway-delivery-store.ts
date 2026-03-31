import type { RuntimeStateSnapshot } from '@agent/memory';

import type { ChannelDeliveryReceipt } from './interfaces/message-gateway.interface';

type RuntimeStateRepositoryLike = {
  load: () => Promise<RuntimeStateSnapshot>;
  save: (snapshot: RuntimeStateSnapshot) => Promise<void>;
};

export async function loadChannelDeliveries(runtimeStateRepository: RuntimeStateRepositoryLike) {
  const snapshot = await runtimeStateRepository.load();
  return snapshot.channelDeliveries ?? [];
}

export async function saveChannelDeliveries(
  runtimeStateRepository: RuntimeStateRepositoryLike,
  deliveries: ChannelDeliveryReceipt[]
) {
  const snapshot = await runtimeStateRepository.load();
  snapshot.channelDeliveries = deliveries.map(item => ({ ...item }));
  await runtimeStateRepository.save(snapshot);
}
