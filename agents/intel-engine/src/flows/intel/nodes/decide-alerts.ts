import { IntelAlertSchema, type IntelAlert, type IntelSignal } from '../../../types';

import type { PatrolGraphState } from '../schemas/patrol-graph-state.schema';

type DecideAlertsNodeInput = Pick<PatrolGraphState, 'scoredSignals'> & Partial<PatrolGraphState>;

function decideAlert(signal: IntelSignal): IntelAlert {
  const isHighPriority = signal.priority === 'P0' || signal.priority === 'P1';
  const isConfirmed = signal.status === 'confirmed';

  return IntelAlertSchema.parse({
    id: `alert_${signal.id}`,
    signalId: signal.id,
    alertLevel: signal.priority,
    alertKind: isConfirmed && isHighPriority ? 'formal' : isHighPriority ? 'pending' : 'digest_only',
    status: isHighPriority ? 'ready' : 'closed',
    createdAt: signal.lastSeenAt,
    updatedAt: signal.lastSeenAt
  });
}

export function decideAlertsNode(input: DecideAlertsNodeInput): PatrolGraphState {
  const generatedAlerts = input.scoredSignals.map(decideAlert);

  return {
    ...input,
    generatedAlerts,
    stats: {
      searchTasks: input.stats?.searchTasks ?? 0,
      rawEvents: input.stats?.rawEvents ?? 0,
      normalizedSignals: input.stats?.normalizedSignals ?? 0,
      mergedSignals: input.stats?.mergedSignals ?? 0,
      scoredSignals: input.stats?.scoredSignals ?? 0,
      generatedAlerts: generatedAlerts.length
    }
  } as PatrolGraphState;
}
