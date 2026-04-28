import { IntelSignalSchema, type IntelSignal } from '../../../types';

import type { PatrolGraphState, PatrolSearchResult } from '../schemas/patrol-graph-state.schema';

function detectEventType(text: string): string {
  const normalizedText = text.toLowerCase();
  if (/(security|vulnerab|cve|exploit|leak|advisory)/i.test(normalizedText)) {
    return 'security_advisory';
  }
  if (/(release|launch|version|changelog|update)/i.test(normalizedText)) {
    return 'release';
  }
  return 'update';
}

function buildDedupeKey(result: PatrolSearchResult): string {
  const queryTokens = result.query
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(token => token.toLowerCase().replace(/[^a-z0-9]+/g, '_'));

  return [result.topicKey, ...queryTokens, result.publishedAt.slice(0, 10)].join(':');
}

function normalizeSignal(result: PatrolSearchResult): IntelSignal {
  return IntelSignalSchema.parse({
    id: result.taskId,
    dedupeKey: buildDedupeKey(result),
    category: result.topicKey as IntelSignal['category'],
    eventType: detectEventType(`${result.title} ${result.snippet} ${result.query}`),
    title: result.title,
    summary: result.snippet,
    priority: result.priorityDefault,
    confidence: 'low',
    status: 'pending',
    firstSeenAt: result.publishedAt,
    lastSeenAt: result.fetchedAt
  });
}

type NormalizeSignalsNodeInput = Pick<PatrolGraphState, 'rawResults'> & Partial<PatrolGraphState>;

export function normalizeSignalsNode(input: NormalizeSignalsNodeInput): PatrolGraphState {
  const normalizedSignals = input.rawResults.map(normalizeSignal);

  return {
    ...input,
    normalizedSignals,
    stats: {
      searchTasks: input.stats?.searchTasks ?? 0,
      rawEvents: input.stats?.rawEvents ?? 0,
      normalizedSignals: normalizedSignals.length ? normalizedSignals.length : (input.stats?.normalizedSignals ?? 0),
      mergedSignals: input.stats?.mergedSignals ?? 0,
      scoredSignals: input.stats?.scoredSignals ?? 0,
      generatedAlerts: input.stats?.generatedAlerts ?? 0
    }
  } as PatrolGraphState;
}
