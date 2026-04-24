import { IntelSignalSchema, type IntelSignal } from '@agent/core';

import type { PatrolGraphState } from '../schemas/patrol-graph-state.schema';

type ScoreSignalNodeInput = Pick<PatrolGraphState, 'mergedSignals'> & Partial<PatrolGraphState>;

function scoreSignal(signal: IntelSignal): IntelSignal {
  const text = `${signal.title} ${signal.summary}`.toLowerCase();
  const isSecuritySignal = /(security|vulnerab|cve|exploit|leak|advisory)/i.test(text);
  const isReleaseSignal = /(release|launch|version|changelog|update)/i.test(text);

  if (isSecuritySignal) {
    return IntelSignalSchema.parse({
      ...signal,
      priority: signal.category.endsWith('_security') ? 'P0' : 'P1',
      confidence: 'high',
      status: 'confirmed'
    });
  }

  if (isReleaseSignal) {
    return IntelSignalSchema.parse({
      ...signal,
      priority: signal.priority === 'P0' ? 'P0' : 'P1',
      confidence: 'medium',
      status: signal.status === 'confirmed' ? 'confirmed' : 'pending'
    });
  }

  return IntelSignalSchema.parse({
    ...signal,
    confidence: signal.priority === 'P0' ? 'medium' : signal.confidence,
    status: signal.status
  });
}

export function scoreSignalNode(input: ScoreSignalNodeInput): PatrolGraphState {
  const scoredSignals = input.mergedSignals.map(scoreSignal);

  return {
    ...input,
    scoredSignals,
    stats: {
      searchTasks: input.stats?.searchTasks ?? 0,
      rawEvents: input.stats?.rawEvents ?? 0,
      normalizedSignals: input.stats?.normalizedSignals ?? 0,
      mergedSignals: input.stats?.mergedSignals ?? 0,
      scoredSignals: scoredSignals.length,
      generatedAlerts: input.stats?.generatedAlerts ?? 0
    }
  } as PatrolGraphState;
}
