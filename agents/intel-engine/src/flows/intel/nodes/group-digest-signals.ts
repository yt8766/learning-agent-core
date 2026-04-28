import type { IntelSignal } from '../../../types';

import {
  DigestGraphStateSchema,
  type DigestGraphState,
  type DigestSignalGroup
} from '../schemas/digest-graph-state.schema';

type GroupDigestSignalsNodeInput = Pick<DigestGraphState, 'collectedSignals'> & Partial<DigestGraphState>;

function buildGroup(signals: IntelSignal[]): DigestSignalGroup[] {
  const groupedSignals = new Map<string, IntelSignal[]>();

  for (const signal of signals) {
    const existing = groupedSignals.get(signal.category) ?? [];
    existing.push(signal);
    groupedSignals.set(signal.category, existing);
  }

  return [...groupedSignals.entries()]
    .map(([category, groupSignals]) => ({
      category: category as IntelSignal['category'],
      signalCount: groupSignals.length,
      highlightSignalIds: groupSignals.map(signal => signal.id)
    }))
    .sort((left, right) => {
      if (right.signalCount !== left.signalCount) {
        return right.signalCount - left.signalCount;
      }

      return left.category.localeCompare(right.category);
    });
}

export function groupDigestSignalsNode(input: GroupDigestSignalsNodeInput): DigestGraphState {
  const groupedSignals = buildGroup(input.collectedSignals);

  return DigestGraphStateSchema.parse({
    ...input,
    groupedSignals,
    stats: {
      collectedSignals: input.stats?.collectedSignals ?? input.collectedSignals.length,
      groupedSignals: groupedSignals.length,
      highlights: input.stats?.highlights ?? 0,
      matchedRoutes: input.stats?.matchedRoutes ?? 0,
      queuedDeliveries: input.stats?.queuedDeliveries ?? 0
    }
  });
}
