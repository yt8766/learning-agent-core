import type {
  KnowledgeChunk,
  KnowledgeRetrievalFilters,
  KnowledgeSource,
  KnowledgeTrustClass,
  RetrievalHit,
  RetrievalRequest
} from '../contracts/types/knowledge-retrieval.types';

export type ResolvedKnowledgeRetrievalFilters = KnowledgeRetrievalFilters & { searchableOnly: boolean };

const KNOWLEDGE_TRUST_RANKING: Record<KnowledgeTrustClass, number> = {
  unverified: 0,
  community: 1,
  curated: 2,
  official: 3,
  internal: 4
};

export function resolveKnowledgeRetrievalFilters(request: RetrievalRequest): ResolvedKnowledgeRetrievalFilters {
  const filters = request.filters ?? {};

  return {
    ...filters,
    sourceTypes: filters.sourceTypes ?? request.allowedSourceTypes,
    knowledgeBaseIds: normalizeStringFilter(filters.knowledgeBaseIds),
    minTrustClass: filters.minTrustClass ?? request.minTrustClass,
    searchableOnly: filters.searchableOnly ?? true
  };
}

export function matchesKnowledgeSourceFilters(
  source: Pick<KnowledgeSource, 'id' | 'sourceType' | 'trustClass'>,
  filters: ResolvedKnowledgeRetrievalFilters
): boolean {
  if (isEnabledFilter(filters.sourceTypes) && !filters.sourceTypes.includes(source.sourceType)) {
    return false;
  }

  if (isEnabledFilter(filters.sourceIds) && !filters.sourceIds.includes(source.id)) {
    return false;
  }

  if (isEnabledFilter(filters.trustClasses) && !filters.trustClasses.includes(source.trustClass)) {
    return false;
  }

  if (filters.minTrustClass && !isAtLeastTrustClass(source.trustClass, filters.minTrustClass)) {
    return false;
  }

  return true;
}

export function matchesKnowledgeChunkFilters(
  chunk: Pick<KnowledgeChunk, 'documentId' | 'searchable' | 'metadata'>,
  filters: ResolvedKnowledgeRetrievalFilters
): boolean {
  if (isEnabledFilter(filters.documentIds) && !filters.documentIds.includes(chunk.documentId)) {
    return false;
  }

  if (
    isEnabledFilter(filters.knowledgeBaseIds) &&
    !matchesRequiredFilterValue(getKnowledgeBaseIdFromMetadata(chunk.metadata), filters.knowledgeBaseIds)
  ) {
    return false;
  }

  if (filters.searchableOnly && !chunk.searchable) {
    return false;
  }

  if (isEnabledFilter(filters.docTypes) && !matchesOptionalMetadataValue(chunk.metadata?.docType, filters.docTypes)) {
    return false;
  }

  if (isEnabledFilter(filters.statuses) && !matchesOptionalMetadataValue(chunk.metadata?.status, filters.statuses)) {
    return false;
  }

  if (
    isEnabledFilter(filters.allowedRoles) &&
    !hasAnyAllowedValue(chunk.metadata?.allowedRoles, filters.allowedRoles)
  ) {
    return false;
  }

  return true;
}

export function matchesKnowledgeHitFilters(
  hit: Pick<RetrievalHit, 'documentId' | 'sourceId' | 'knowledgeBaseId' | 'sourceType' | 'trustClass'> & {
    metadata?: KnowledgeChunk['metadata'];
  },
  filters: ResolvedKnowledgeRetrievalFilters
): boolean {
  if (
    isEnabledFilter(filters.knowledgeBaseIds) &&
    !matchesRequiredFilterValue(hit.knowledgeBaseId, filters.knowledgeBaseIds)
  ) {
    return false;
  }

  const chunkFilters = {
    ...filters,
    knowledgeBaseIds: undefined
  };

  return (
    matchesKnowledgeSourceFilters(
      {
        id: hit.sourceId,
        sourceType: hit.sourceType,
        trustClass: hit.trustClass
      },
      filters
    ) &&
    matchesKnowledgeChunkFilters(
      {
        documentId: hit.documentId,
        searchable: true,
        metadata: hit.metadata
      },
      chunkFilters
    )
  );
}

export function getKnowledgeBaseIdFromMetadata(metadata: KnowledgeChunk['metadata']): string | undefined {
  const knowledgeBaseId = metadata?.knowledgeBaseId;
  return typeof knowledgeBaseId === 'string' && knowledgeBaseId.trim().length > 0 ? knowledgeBaseId.trim() : undefined;
}

function isAtLeastTrustClass(actual: KnowledgeTrustClass, minimum: KnowledgeTrustClass): boolean {
  return KNOWLEDGE_TRUST_RANKING[actual] >= KNOWLEDGE_TRUST_RANKING[minimum];
}

function isEnabledFilter<T>(values: T[] | undefined): values is T[] {
  return values !== undefined && values.length > 0;
}

function normalizeStringFilter(values: string[] | undefined): string[] | undefined {
  if (!values) return undefined;

  const normalizedValues = values.map(value => value.trim()).filter(value => value.length > 0);
  return normalizedValues.length > 0 ? normalizedValues : undefined;
}

function matchesRequiredFilterValue(value: string | undefined, allowedValues: string[]): boolean {
  return value !== undefined && allowedValues.includes(value);
}

function matchesOptionalMetadataValue(value: string | undefined, allowedValues: string[]): boolean {
  return value !== undefined && allowedValues.includes(value);
}

function hasAnyAllowedValue(values: string[] | undefined, allowedValues: string[]): boolean {
  return values !== undefined && values.some(value => allowedValues.includes(value));
}
