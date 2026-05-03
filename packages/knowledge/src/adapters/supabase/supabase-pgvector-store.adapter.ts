import type {
  JsonObject,
  KnowledgeSdkVectorDeleteInput,
  KnowledgeSdkVectorDeleteResult,
  KnowledgeSdkVectorSearchInput,
  KnowledgeSdkVectorSearchResult,
  KnowledgeSdkVectorStore,
  KnowledgeSdkVectorUpsertInput,
  KnowledgeSdkVectorUpsertResult
} from '../../index';

import { AdapterError } from '../shared/errors/adapter-error';
import {
  getSingleId,
  getStringField,
  groupSdkRecords,
  isKnowledgeSdkUpsertInput,
  mapFilters,
  mapSearchMatchToSdkHit,
  mapSearchRow,
  normalizeSearchInput,
  requiredNonNegativeIntegerField,
  toAdapterError,
  validateBatchEmbeddings,
  validateVector,
  withOptionalTenant
} from './supabase-pgvector-store.adapter.helpers';

export interface SupabaseRpcResult<TData = unknown> {
  data: TData | null;
  error: unknown | null;
}

export interface SupabaseRpcClientLike {
  rpc(name: string, args: Record<string, unknown>): Promise<SupabaseRpcResult>;
}

export interface SupabasePgVectorStoreAdapterOptions {
  client: SupabaseRpcClientLike;
  rpcNames?: Partial<SupabasePgVectorStoreRpcNames>;
  tenantId?: string;
  knowledgeBaseId?: string;
  documentId?: string;
}

export interface SupabasePgVectorStoreRpcNames {
  upsert: string;
  search: string;
  deleteByDocumentId: string;
}

export interface SupabasePgVectorChunkInput {
  id: string;
  text: string;
  embedding: number[];
  ordinal?: number;
  tokenCount?: number;
  metadata?: JsonObject;
}

export interface SupabasePgVectorUpsertInput {
  tenantId?: string;
  knowledgeBaseId: string;
  documentId: string;
  chunks: SupabasePgVectorChunkInput[];
}

export interface SupabasePgVectorUpsertResult {
  upsertedCount: number;
}

export interface SupabasePgVectorSearchFilters {
  documentIds?: string[];
  tags?: string[];
  metadata?: JsonObject;
}

export interface SupabasePgVectorSearchInput {
  tenantId?: string;
  knowledgeBaseId: string;
  query?: string;
  embedding: number[];
  topK: number;
  filters?: SupabasePgVectorSearchFilters;
}

export interface SupabasePgVectorSearchMatch {
  chunkId: string;
  documentId: string;
  text: string;
  score: number;
  metadata?: JsonObject;
}

export interface SupabasePgVectorSearchResult extends KnowledgeSdkVectorSearchResult {
  matches: SupabasePgVectorSearchMatch[];
}

export interface SupabasePgVectorDeleteByDocumentIdInput {
  tenantId?: string;
  knowledgeBaseId: string;
  documentId: string;
}

export interface SupabasePgVectorDeleteResult {
  deletedCount: number;
}

const DEFAULT_RPC_NAMES: SupabasePgVectorStoreRpcNames = {
  upsert: 'upsert_knowledge_chunks',
  search: 'match_knowledge_chunks',
  deleteByDocumentId: 'delete_knowledge_document_chunks'
};

export class SupabasePgVectorStoreAdapter implements KnowledgeSdkVectorStore {
  private readonly client: SupabaseRpcClientLike;
  private readonly rpcNames: SupabasePgVectorStoreRpcNames;
  private readonly tenantId?: string;
  private readonly knowledgeBaseId?: string;
  private readonly documentId?: string;

  constructor(options: SupabasePgVectorStoreAdapterOptions) {
    this.client = options.client;
    this.rpcNames = { ...DEFAULT_RPC_NAMES, ...options.rpcNames };
    this.tenantId = options.tenantId;
    this.knowledgeBaseId = options.knowledgeBaseId;
    this.documentId = options.documentId;
  }

  async upsert(input: KnowledgeSdkVectorUpsertInput): Promise<KnowledgeSdkVectorUpsertResult>;
  async upsert(input: SupabasePgVectorUpsertInput): Promise<SupabasePgVectorUpsertResult>;
  async upsert(
    input: KnowledgeSdkVectorUpsertInput | SupabasePgVectorUpsertInput
  ): Promise<SupabasePgVectorUpsertResult> {
    const groups = isKnowledgeSdkUpsertInput(input)
      ? groupSdkRecords(input.records, {
          tenantId: this.tenantId,
          knowledgeBaseId: this.knowledgeBaseId,
          documentId: this.documentId
        })
      : [
          {
            tenantId: input.tenantId ?? this.tenantId,
            knowledgeBaseId: input.knowledgeBaseId,
            documentId: input.documentId,
            chunks: input.chunks
          }
        ];

    if (groups.every(group => group.chunks.length === 0)) {
      return { upsertedCount: 0 };
    }

    let upsertedCount = 0;

    for (const group of groups) {
      if (group.chunks.length === 0) {
        continue;
      }

      validateBatchEmbeddings(group.chunks);

      const data = await this.callRpc(this.rpcNames.upsert, {
        ...withOptionalTenant(group.tenantId),
        knowledge_base_id: group.knowledgeBaseId,
        document_id: group.documentId,
        records: group.chunks.map(chunk => ({
          chunk_id: chunk.id,
          text: chunk.text,
          embedding: chunk.embedding,
          ordinal: chunk.ordinal ?? null,
          token_count: chunk.tokenCount ?? null,
          metadata: chunk.metadata ?? {}
        }))
      });

      upsertedCount += requiredNonNegativeIntegerField(data, 'upserted_count', 'upsert RPC result');
    }

    return { upsertedCount };
  }

  async search(input: KnowledgeSdkVectorSearchInput): Promise<SupabasePgVectorSearchResult>;
  async search(input: SupabasePgVectorSearchInput): Promise<SupabasePgVectorSearchResult>;
  async search(
    input: KnowledgeSdkVectorSearchInput | SupabasePgVectorSearchInput
  ): Promise<SupabasePgVectorSearchResult> {
    validateVector(input.embedding, 'search embedding');
    if (!Number.isInteger(input.topK) || input.topK <= 0) {
      throw toAdapterError('search topK must be a positive integer', { topK: input.topK });
    }

    const normalizedInput = normalizeSearchInput(input, this.tenantId, this.knowledgeBaseId);
    const data = await this.callRpc(this.rpcNames.search, {
      ...withOptionalTenant(normalizedInput.tenantId),
      knowledge_base_id: normalizedInput.knowledgeBaseId,
      query_text: normalizedInput.query ?? null,
      embedding: input.embedding,
      top_k: input.topK,
      filters: mapFilters(normalizedInput.filters)
    });

    if (!Array.isArray(data)) {
      throw toAdapterError('search RPC result data must be an array', data);
    }

    const matches = data.map(mapSearchRow);

    return { hits: matches.map(mapSearchMatchToSdkHit), matches };
  }

  async delete(input: KnowledgeSdkVectorDeleteInput): Promise<KnowledgeSdkVectorDeleteResult> {
    const filter = input.filter;
    const knowledgeBaseId = getStringField(filter, 'knowledgeBaseId') ?? this.knowledgeBaseId;
    const documentId = getStringField(filter, 'documentId') ?? this.documentId ?? getSingleId(input.ids);

    if (!knowledgeBaseId) {
      throw toAdapterError('SDK delete requires knowledgeBaseId in filter or adapter options', input);
    }
    if (!documentId) {
      throw toAdapterError('SDK delete requires documentId in filter, ids, or adapter options', input);
    }

    return this.deleteByDocumentId({
      tenantId: getStringField(filter, 'tenantId') ?? this.tenantId,
      knowledgeBaseId,
      documentId
    });
  }

  async deleteByDocumentId(input: SupabasePgVectorDeleteByDocumentIdInput): Promise<SupabasePgVectorDeleteResult> {
    const data = await this.callRpc(this.rpcNames.deleteByDocumentId, {
      ...withOptionalTenant(input.tenantId),
      knowledge_base_id: input.knowledgeBaseId,
      document_id: input.documentId
    });

    return { deletedCount: requiredNonNegativeIntegerField(data, 'deleted_count', 'delete RPC result') };
  }

  private async callRpc(name: string, args: Record<string, unknown>): Promise<unknown> {
    try {
      const result = await this.client.rpc(name, args);
      if (result.error) {
        throw toAdapterError(`RPC ${name} failed`, result.error);
      }
      return result.data;
    } catch (err) {
      if (err instanceof AdapterError) {
        throw err;
      }
      throw toAdapterError(`RPC ${name} failed`, err);
    }
  }
}
