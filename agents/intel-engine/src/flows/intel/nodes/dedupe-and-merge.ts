import { IntelSignalSchema, type IntelSignal } from '@agent/core';

import type { PatrolGraphState } from '../schemas/patrol-graph-state.schema';

interface DedupeAndMergeNodeInput extends Partial<PatrolGraphState> {
  existingSignals: IntelSignal[];
  incomingSignals: IntelSignal[];
}

function resolvePriority(existing: IntelSignal, incoming: IntelSignal): IntelSignal['priority'] {
  const priorityOrder = { P0: 0, P1: 1, P2: 2 } as const;
  return priorityOrder[incoming.priority] < priorityOrder[existing.priority] ? incoming.priority : existing.priority;
}

function mergeSignal(existing: IntelSignal, incoming: IntelSignal): IntelSignal {
  return IntelSignalSchema.parse({
    ...existing,
    title: incoming.title || existing.title,
    summary: incoming.summary || existing.summary,
    priority: resolvePriority(existing, incoming),
    confidence:
      incoming.confidence === 'high' || existing.confidence !== 'high' ? incoming.confidence : existing.confidence,
    status: existing.status === 'confirmed' || incoming.status === 'confirmed' ? 'confirmed' : incoming.status,
    firstSeenAt: existing.firstSeenAt < incoming.firstSeenAt ? existing.firstSeenAt : incoming.firstSeenAt,
    lastSeenAt: existing.lastSeenAt > incoming.lastSeenAt ? existing.lastSeenAt : incoming.lastSeenAt
  });
}

export function dedupeAndMergeNode(input: DedupeAndMergeNodeInput): PatrolGraphState {
  const byDedupeKey = new Map(input.existingSignals.map(signal => [signal.dedupeKey, signal]));
  const mergedByDedupeKey = new Map<string, IntelSignal>();
  const mergedDedupeKeys: string[] = [];
  const signalMergeMap: Record<string, string> = {};

  for (const incoming of input.incomingSignals) {
    const existing = byDedupeKey.get(incoming.dedupeKey);
    if (!existing) {
      const parsed = IntelSignalSchema.parse(incoming);
      byDedupeKey.set(parsed.dedupeKey, parsed);
      mergedByDedupeKey.set(parsed.dedupeKey, parsed);
      mergedDedupeKeys.push(parsed.dedupeKey);
      signalMergeMap[incoming.id] = parsed.id;
      continue;
    }
    const merged = mergeSignal(existing, incoming);
    byDedupeKey.set(merged.dedupeKey, merged);
    if (!mergedByDedupeKey.has(merged.dedupeKey)) {
      mergedDedupeKeys.push(merged.dedupeKey);
    }
    mergedByDedupeKey.set(merged.dedupeKey, merged);
    signalMergeMap[incoming.id] = merged.id;
  }

  const mergedSignals = mergedDedupeKeys
    .map(dedupeKey => mergedByDedupeKey.get(dedupeKey))
    .filter((signal): signal is IntelSignal => Boolean(signal));

  return {
    ...input,
    mergedSignals,
    signalMergeMap: {
      ...(input.signalMergeMap ?? {}),
      ...signalMergeMap
    },
    stats: {
      searchTasks: input.stats?.searchTasks ?? 0,
      rawEvents: input.stats?.rawEvents ?? 0,
      normalizedSignals: input.stats?.normalizedSignals ?? 0,
      mergedSignals: mergedSignals.length,
      scoredSignals: input.stats?.scoredSignals ?? 0,
      generatedAlerts: input.stats?.generatedAlerts ?? 0
    }
  } as PatrolGraphState;
}
