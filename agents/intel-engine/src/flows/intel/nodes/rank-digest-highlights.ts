import type { IntelSignal } from '../../../types';

import { DigestGraphStateSchema, type DigestGraphState } from '../schemas/digest-graph-state.schema';

type RankDigestHighlightsNodeInput = Pick<DigestGraphState, 'collectedSignals'> & Partial<DigestGraphState>;

function priorityWeight(priority: IntelSignal['priority']): number {
  switch (priority) {
    case 'P0':
      return 300;
    case 'P1':
      return 200;
    case 'P2':
      return 100;
  }
}

function confidenceWeight(confidence: IntelSignal['confidence']): number {
  switch (confidence) {
    case 'high':
      return 30;
    case 'medium':
      return 20;
    case 'low':
      return 10;
  }
}

function statusWeight(status: IntelSignal['status']): number {
  switch (status) {
    case 'confirmed':
      return 40;
    case 'pending':
      return 20;
    case 'closed':
      return 0;
  }
}

function rankSignal(signal: IntelSignal): { score: number; reasons: string[] } {
  const reasons = [`priority:${signal.priority}`, `status:${signal.status}`, `confidence:${signal.confidence}`];

  if (signal.category.endsWith('_security')) {
    reasons.push('security-category');
  }

  const score =
    priorityWeight(signal.priority) +
    confidenceWeight(signal.confidence) +
    statusWeight(signal.status) +
    (signal.category.endsWith('_security') ? 15 : 0);

  return {
    score,
    reasons
  };
}

export function rankDigestHighlightsNode(input: RankDigestHighlightsNodeInput): DigestGraphState {
  const highlights = [...input.collectedSignals]
    .map(signal => ({
      signal,
      ...rankSignal(signal)
    }))
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return Date.parse(right.signal.lastSeenAt) - Date.parse(left.signal.lastSeenAt);
    })
    .map((highlight, index) => ({
      signal: highlight.signal,
      rank: index + 1,
      reasons: highlight.reasons
    }));

  return DigestGraphStateSchema.parse({
    ...input,
    highlights,
    stats: {
      collectedSignals: input.stats?.collectedSignals ?? input.collectedSignals.length,
      groupedSignals: input.stats?.groupedSignals ?? 0,
      highlights: highlights.length,
      matchedRoutes: input.stats?.matchedRoutes ?? 0,
      queuedDeliveries: input.stats?.queuedDeliveries ?? 0
    }
  });
}
