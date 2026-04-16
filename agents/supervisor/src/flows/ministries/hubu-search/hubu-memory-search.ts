import type { MemoryRepository, MemorySearchService } from '@agent/memory';
import type { MemoryRecord, MemorySearchResult, RuleRecord } from '@agent/shared';
import { archivalMemorySearchByParams } from '@agent/runtime';

interface SearchHubuMemoriesParams {
  goal: string;
  taskId: string;
  memoryRepository: MemoryRepository;
  memorySearchService?: MemorySearchService;
}

export async function searchHubuMemories(params: SearchHubuMemoriesParams): Promise<{
  memories: MemoryRecord[];
  rules: RuleRecord[];
  reflections: MemorySearchResult['reflections'];
}> {
  if (!params.memorySearchService) {
    return {
      memories: await params.memoryRepository.search(params.goal, 5),
      rules: [],
      reflections: []
    };
  }

  const structured = await archivalMemorySearchByParams(params.memorySearchService, {
    query: params.goal,
    limit: 5,
    actorRole: 'research',
    scopeType: 'task',
    allowedScopeTypes: ['task', 'workspace', 'team', 'org', 'global', 'user'],
    entityContext: [{ entityType: 'project', entityId: params.taskId }],
    memoryTypes: ['constraint', 'procedure', 'skill-experience', 'failure-pattern'],
    includeRules: true,
    includeReflections: true
  });
  if (!structured) {
    return {
      memories: await params.memoryRepository.search(params.goal, 5),
      rules: [],
      reflections: []
    };
  }

  return {
    memories: dedupeById([...structured.coreMemories, ...structured.archivalMemories]),
    rules: dedupeById(structured.rules),
    reflections: structured.reflections.slice(0, 2)
  };
}

function dedupeById<T extends { id: string }>(items: T[]) {
  const seen = new Set<string>();
  const deduped: T[] = [];
  for (const item of items) {
    if (seen.has(item.id)) {
      continue;
    }
    seen.add(item.id);
    deduped.push(item);
  }
  return deduped;
}
