import type { PatrolGraphState, PatrolSearchResult, PatrolSearchTask } from '../schemas/patrol-graph-state.schema';
import { resolveIntelContentHash } from './intel-evidence-helpers';

interface WebSearchMcpClientManager {
  hasCapability(capabilityId: string): boolean;
  invokeTool(
    toolName: string,
    request: {
      taskId: string;
      toolName: string;
      intent: string;
      input: Record<string, unknown>;
      requestedBy: 'agent' | 'user';
    }
  ): Promise<{
    ok: boolean;
    rawOutput?: unknown;
    errorMessage?: string;
  }>;
}

export interface RunWebSearchNodeInput {
  mcpClientManager?: WebSearchMcpClientManager;
}

function resolveSourceName(rawSourceName: unknown, url: string): string | undefined {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return undefined;
  }

  if (typeof rawSourceName === 'string' && rawSourceName.trim().length > 0) {
    return rawSourceName;
  }

  return parsedUrl.hostname;
}

function mapSearchResults(task: PatrolSearchTask, payload: unknown, fetchedAt: string): PatrolSearchResult[] {
  const results = Array.isArray((payload as { results?: unknown[] } | undefined)?.results)
    ? ((payload as { results: unknown[] }).results ?? [])
    : [];

  return results.flatMap(result => {
    if (!result || typeof result !== 'object') {
      return [];
    }

    const raw = result as Record<string, unknown>;
    const title = typeof raw.title === 'string' ? raw.title : undefined;
    const url = typeof raw.url === 'string' ? raw.url : undefined;
    const snippet =
      typeof raw.summary === 'string' ? raw.summary : typeof raw.snippet === 'string' ? raw.snippet : undefined;

    if (!title || !url || !snippet) {
      return [];
    }

    const sourceName = resolveSourceName(raw.sourceName, url);
    if (!sourceName) {
      return [];
    }

    const publishedAt =
      typeof raw.publishedAt === 'string'
        ? raw.publishedAt
        : typeof raw.published_at === 'string'
          ? raw.published_at
          : fetchedAt;

    return [
      {
        taskId: task.taskId,
        topicKey: task.topicKey,
        query: task.query,
        priorityDefault: task.priorityDefault,
        sourceName,
        sourceType: raw.sourceType === 'community' ? 'community' : 'official',
        title,
        url,
        snippet,
        publishedAt,
        fetchedAt,
        contentHash: resolveIntelContentHash({
          taskId: task.taskId,
          url,
          publishedAt,
          title
        })
      } satisfies PatrolSearchResult
    ];
  });
}

export async function runWebSearchNode(
  state: Pick<PatrolGraphState, 'mode' | 'jobId' | 'startedAt' | 'searchTasks'> & Partial<PatrolGraphState>,
  input: RunWebSearchNodeInput
): Promise<PatrolGraphState> {
  const mcpClientManager = input.mcpClientManager;

  if (!mcpClientManager?.hasCapability('webSearchPrime')) {
    return {
      ...state,
      rawResults: [],
      errors: [...(state.errors ?? []), 'webSearchPrime capability is unavailable']
    } as PatrolGraphState;
  }

  const rawResults: PatrolSearchResult[] = [];

  for (const task of state.searchTasks) {
    const result = await mcpClientManager.invokeTool('webSearchPrime', {
      taskId: task.taskId,
      toolName: 'webSearchPrime',
      intent: 'CALL_EXTERNAL_API',
      input: {
        query: task.query,
        goal: `Collect latest intel for ${task.topicKey}`,
        freshnessHint: task.priorityDefault === 'P0' ? 'urgent' : 'recent'
      },
      requestedBy: 'agent'
    });

    if (!result.ok) {
      continue;
    }

    rawResults.push(...mapSearchResults(task, result.rawOutput, state.startedAt));
  }

  return {
    ...state,
    rawResults,
    stats: {
      searchTasks: state.searchTasks.length,
      rawEvents: rawResults.length,
      normalizedSignals: state.stats?.normalizedSignals ?? 0,
      mergedSignals: state.stats?.mergedSignals ?? 0,
      scoredSignals: state.stats?.scoredSignals ?? 0,
      generatedAlerts: state.stats?.generatedAlerts ?? 0
    }
  } as PatrolGraphState;
}
