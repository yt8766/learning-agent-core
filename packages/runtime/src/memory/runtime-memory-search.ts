import type {
  MemoryRecord,
  MemorySearchRequest,
  MemorySearchResult,
  MemorySearchService,
  RuleRecord
} from '@agent/memory';

interface RuntimeMemorySearchParams {
  query: string;
  limit?: number;
  actorRole?: string;
  scopeType?: MemorySearchRequest['scopeContext'] extends infer T
    ? T extends { scopeType?: infer Scope }
      ? Scope
      : never
    : never;
  allowedScopeTypes?: NonNullable<MemorySearchRequest['scopeContext']>['allowedScopeTypes'];
  userId?: string;
  workspaceId?: string;
  teamId?: string;
  orgId?: string;
  taskId?: string;
  memoryTypes?: MemorySearchRequest['memoryTypes'];
  includeRules?: boolean;
  includeReflections?: boolean;
  entityContext?: MemorySearchRequest['entityContext'];
}

export function buildRuntimeMemorySearchRequest(params: RuntimeMemorySearchParams): MemorySearchRequest {
  const entityContext = [...(params.entityContext ?? [])];
  if (params.userId) {
    entityContext.push({ entityType: 'user', entityId: params.userId });
  }
  if (params.workspaceId) {
    entityContext.push({ entityType: 'workspace', entityId: params.workspaceId });
  }
  if (params.taskId) {
    entityContext.push({ entityType: 'project', entityId: params.taskId });
  }

  return {
    query: params.query,
    limit: params.limit,
    scopeContext: {
      actorRole: params.actorRole,
      scopeType: params.scopeType,
      allowedScopeTypes: params.allowedScopeTypes,
      userId: params.userId,
      workspaceId: params.workspaceId,
      teamId: params.teamId,
      orgId: params.orgId
    },
    entityContext: entityContext.length > 0 ? dedupeEntities(entityContext) : undefined,
    memoryTypes: params.memoryTypes,
    includeRules: params.includeRules,
    includeReflections: params.includeReflections
  };
}

export async function searchRuntimeMemories(
  memorySearchService: MemorySearchService | undefined,
  params: RuntimeMemorySearchParams
): Promise<MemorySearchResult | undefined> {
  if (!memorySearchService) {
    return undefined;
  }

  return memorySearchService.search(buildRuntimeMemorySearchRequest(params));
}

export function flattenStructuredMemories(result: MemorySearchResult | undefined): MemoryRecord[] {
  if (!result) {
    return [];
  }

  return dedupeById([...result.coreMemories, ...result.archivalMemories]);
}

export function limitStructuredRules(result: MemorySearchResult | undefined, limit: number): RuleRecord[] {
  if (!result) {
    return [];
  }

  return dedupeById(result.rules).slice(0, limit);
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

function dedupeEntities(items: NonNullable<MemorySearchRequest['entityContext']>) {
  const seen = new Set<string>();
  return items.filter(item => {
    const key = `${item.entityType}:${item.entityId}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}
