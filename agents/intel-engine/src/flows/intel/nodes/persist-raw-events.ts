import type { PatrolGraphState, PatrolSearchResult } from '../schemas/patrol-graph-state.schema';
import { resolveIntelContentHash } from './intel-evidence-helpers';

interface RawEventRepository {
  insert(input: {
    jobId: string;
    query: string;
    sourceName: string;
    sourceType: string;
    title: string;
    url: string;
    snippet: string;
    publishedAt: string;
    fetchedAt: string;
    contentHash: string;
  }): number;
}

interface PersistRawEventsNodeInput extends Partial<PatrolGraphState> {
  jobId: string;
  rawResults: PatrolSearchResult[];
  repositories: {
    rawEvents: RawEventRepository;
  };
}

function resolveContentHash(result: PatrolSearchResult): string {
  return (
    result.contentHash ??
    resolveIntelContentHash({
      taskId: result.taskId,
      url: result.url,
      publishedAt: result.publishedAt,
      title: result.title
    })
  );
}

export function persistRawEventsNode(input: PersistRawEventsNodeInput): PatrolGraphState {
  const persistedRawEventIds = input.rawResults.map(result =>
    input.repositories.rawEvents.insert({
      jobId: input.jobId,
      query: result.query,
      sourceName: result.sourceName,
      sourceType: result.sourceType,
      title: result.title,
      url: result.url,
      snippet: result.snippet,
      publishedAt: result.publishedAt,
      fetchedAt: result.fetchedAt,
      contentHash: resolveContentHash(result)
    })
  );

  return {
    ...input,
    persistedRawEventIds,
    stats: {
      searchTasks: input.stats?.searchTasks ?? 0,
      rawEvents: persistedRawEventIds.length,
      normalizedSignals: input.stats?.normalizedSignals ?? 0,
      mergedSignals: input.stats?.mergedSignals ?? 0,
      scoredSignals: input.stats?.scoredSignals ?? 0,
      generatedAlerts: input.stats?.generatedAlerts ?? 0
    }
  } as PatrolGraphState;
}
