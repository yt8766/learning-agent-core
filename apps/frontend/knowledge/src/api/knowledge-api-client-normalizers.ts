import type { EmbeddingModelOption, KnowledgeBase, PageResult } from '../types/api';

export interface KnowledgeBasesServiceResponse {
  bases: KnowledgeServiceBase[];
}

export interface KnowledgeServiceBase {
  id: string;
  name: string;
  description: string;
  createdByUserId: string;
  status: 'active' | 'archived';
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeEmbeddingModelsServiceResponse {
  items: Array<{
    id: string;
    label?: string;
    name?: string;
    provider: string;
    dimension?: number;
    dimensions?: number;
    description?: string;
    status?: 'active' | 'disabled' | 'available' | 'unconfigured' | 'degraded';
  }>;
  page?: number;
  pageSize?: number;
  total?: number;
}

export function normalizeKnowledgeBases(
  input: PageResult<KnowledgeBase> | KnowledgeBasesServiceResponse
): PageResult<KnowledgeBase> {
  if ('items' in input) {
    return input;
  }
  return {
    items: input.bases.map(normalizeKnowledgeBase),
    total: input.bases.length,
    page: 1,
    pageSize: input.bases.length
  };
}

export function normalizeKnowledgeBase(base: KnowledgeServiceBase): KnowledgeBase {
  return {
    id: base.id,
    workspaceId: 'default',
    name: base.name,
    description: base.description,
    tags: [],
    visibility: 'private',
    status: base.status === 'active' ? 'active' : 'archived',
    documentCount: 0,
    chunkCount: 0,
    readyDocumentCount: 0,
    failedDocumentCount: 0,
    createdBy: base.createdByUserId,
    createdAt: base.createdAt,
    updatedAt: base.updatedAt
  };
}

export function normalizeEmbeddingModels(
  input: PageResult<EmbeddingModelOption> | KnowledgeEmbeddingModelsServiceResponse
): PageResult<EmbeddingModelOption> {
  return {
    items: input.items.map(normalizeEmbeddingModel),
    total: input.total ?? input.items.length,
    page: input.page ?? 1,
    pageSize: input.pageSize ?? input.items.length
  };
}

function normalizeEmbeddingModel(
  item: EmbeddingModelOption | KnowledgeEmbeddingModelsServiceResponse['items'][number]
): EmbeddingModelOption {
  return {
    id: item.id,
    name: item.name ?? ('label' in item ? item.label : undefined) ?? item.id,
    provider: item.provider,
    dimension: item.dimension ?? ('dimensions' in item ? item.dimensions : undefined),
    description: item.description,
    status: item.status
  };
}

export function mergeUploadMetadata(
  metadata: Record<string, unknown> | undefined,
  embeddingModelId: string | undefined
) {
  if (!embeddingModelId) {
    return metadata;
  }
  return {
    ...metadata,
    embeddingModelId
  };
}
