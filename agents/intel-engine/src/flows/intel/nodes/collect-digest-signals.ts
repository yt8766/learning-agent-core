import type { IntelSignal } from '../../../types';

import { DigestGraphStateSchema, type DigestGraphState } from '../schemas/digest-graph-state.schema';

export interface CollectDigestSignalsNodeInput {
  jobId: string;
  startedAt: string;
  signals: IntelSignal[];
}

function toDigestDate(startedAt: string): string {
  return startedAt.slice(0, 10);
}

function toWindowEnd(windowStart: string): string {
  const nextDay = new Date(Date.parse(windowStart) + 24 * 60 * 60 * 1000);
  return nextDay.toISOString();
}

function isWithinWindow(candidate: string, windowStart: string, windowEnd: string): boolean {
  const candidateTime = Date.parse(candidate);
  return candidateTime >= Date.parse(windowStart) && candidateTime < Date.parse(windowEnd);
}

export function collectDigestSignalsNode(input: CollectDigestSignalsNodeInput): DigestGraphState {
  const digestDate = toDigestDate(input.startedAt);
  const windowStart = `${digestDate}T00:00:00.000Z`;
  const windowEnd = toWindowEnd(windowStart);
  const collectedSignals = input.signals.filter(signal => isWithinWindow(signal.lastSeenAt, windowStart, windowEnd));

  return DigestGraphStateSchema.parse({
    mode: 'digest',
    jobId: input.jobId,
    startedAt: input.startedAt,
    digestDate,
    windowStart,
    windowEnd,
    collectedSignals,
    stats: {
      collectedSignals: collectedSignals.length,
      groupedSignals: 0,
      highlights: 0,
      matchedRoutes: 0,
      queuedDeliveries: 0
    }
  });
}
