import {
  SupabasePgVectorStoreAdapter,
  type SupabasePgVectorSearchInput,
  type SupabasePgVectorSearchMatch,
  type SupabasePgVectorUpsertInput,
  type SupabaseRpcClientLike
} from '@agent/knowledge';

import type {
  KnowledgeVectorStore,
  KnowledgeVectorStoreSearchInput,
  KnowledgeVectorStoreSearchMatch,
  KnowledgeVectorStoreUpsertInput
} from './interfaces/knowledge-ingestion.types';
import { NoopKnowledgeVectorStore } from './knowledge-ingestion.service';
import type { KnowledgeVectorStoreProviderConfig } from './knowledge-provider.config';

type SupabaseVectorStoreConfig = Extract<KnowledgeVectorStoreProviderConfig, { kind: 'supabase-pgvector' }>;
type JsonValue = string | number | boolean | null | JsonObject | JsonValue[];
type JsonObject = { [key: string]: JsonValue };

const SUPABASE_PGVECTOR_EMBEDDING_DIMENSIONS = 1536;
const SUPABASE_PGVECTOR_DIMENSION_ERROR = 'Supabase pgvector embeddings must contain 1536 dimensions';

export type KnowledgeVectorStoreProviderKind = KnowledgeVectorStoreProviderConfig['kind'];

export interface SupabaseRpcFetchResponseLike {
  ok: boolean;
  status: number;
  json?(): Promise<unknown>;
  text?(): Promise<string>;
}

export type SupabaseRpcFetcherLike = (
  url: string,
  init: {
    method: 'POST';
    headers: Record<string, string>;
    body: string;
  }
) => Promise<SupabaseRpcFetchResponseLike>;

export interface CreateSupabaseRpcClientOptions {
  supabaseUrl: string;
  serviceRoleKey: string;
  fetcher?: SupabaseRpcFetcherLike;
}

export type KnowledgeVectorStoreFactoryConfig =
  | Extract<KnowledgeVectorStoreProviderConfig, { kind: 'memory' }>
  | (SupabaseVectorStoreConfig & { fetcher?: SupabaseRpcFetcherLike });

export function createKnowledgeVectorStoreKind(
  config: KnowledgeVectorStoreProviderConfig
): KnowledgeVectorStoreProviderKind {
  return config.kind;
}

export function createSupabaseRpcClient(options: CreateSupabaseRpcClientOptions): SupabaseRpcClientLike {
  const baseUrl = options.supabaseUrl.replace(/\/+$/, '');
  const fetcher = options.fetcher ?? resolveGlobalFetch();

  return {
    async rpc(name: string, args: Record<string, unknown>) {
      const response = await fetcher(`${baseUrl}/rest/v1/rpc/${name}`, {
        method: 'POST',
        headers: {
          apikey: options.serviceRoleKey,
          Authorization: `Bearer ${options.serviceRoleKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(args)
      });
      const body = await parseSupabaseRpcBody(response);

      if (!response.ok) {
        return { data: null, error: { status: response.status, body } };
      }

      return { data: body, error: null };
    }
  };
}

export function createKnowledgeVectorStore(config: KnowledgeVectorStoreFactoryConfig): KnowledgeVectorStore {
  if (config.kind === 'memory') {
    return new NoopKnowledgeVectorStore();
  }

  return new SupabaseKnowledgeVectorStore({
    adapter: new SupabasePgVectorStoreAdapter({
      client: createSupabaseRpcClient({
        supabaseUrl: config.supabaseUrl,
        serviceRoleKey: config.serviceRoleKey,
        fetcher: config.fetcher
      })
    })
  });
}

class SupabaseKnowledgeVectorStore implements KnowledgeVectorStore {
  constructor(private readonly options: { adapter: SupabasePgVectorStoreAdapter }) {}

  async upsert(input: KnowledgeVectorStoreUpsertInput): Promise<{ inserted: number }> {
    for (const chunk of input.chunks) {
      requireSupabaseEmbeddingDimensions(chunk.embedding);
    }

    const adapterInput: SupabasePgVectorUpsertInput = {
      tenantId: input.tenantId,
      knowledgeBaseId: input.knowledgeBaseId,
      documentId: input.documentId,
      chunks: input.chunks.map(chunk => ({
        id: chunk.id,
        text: chunk.text,
        embedding: chunk.embedding,
        ordinal: chunk.ordinal,
        tokenCount: chunk.tokenCount,
        metadata: toJsonObject(chunk.metadata)
      }))
    };
    const result = await this.options.adapter.upsert(adapterInput);

    return { inserted: result.upsertedCount };
  }

  async search(input: KnowledgeVectorStoreSearchInput): Promise<{ matches: KnowledgeVectorStoreSearchMatch[] }> {
    requireSupabaseEmbeddingDimensions(input.embedding);

    const adapterInput: SupabasePgVectorSearchInput = {
      tenantId: input.tenantId,
      knowledgeBaseId: input.knowledgeBaseId,
      embedding: input.embedding,
      topK: input.topK,
      filters: {
        documentIds: input.filters?.documentIds,
        metadata: toJsonObject(input.filters?.metadata)
      }
    };
    const result = await this.options.adapter.search(adapterInput);

    return { matches: result.matches.map(mapSupabaseMatch) };
  }

  async deleteByDocumentId(input: {
    tenantId: string;
    knowledgeBaseId: string;
    documentId: string;
  }): Promise<{ deleted: number }> {
    const result = await this.options.adapter.deleteByDocumentId(input);

    return { deleted: result.deletedCount };
  }
}

function mapSupabaseMatch(match: SupabasePgVectorSearchMatch): KnowledgeVectorStoreSearchMatch {
  return {
    chunkId: match.chunkId,
    documentId: match.documentId,
    score: match.score,
    text: match.text,
    metadata: match.metadata
  };
}

function resolveGlobalFetch(): SupabaseRpcFetcherLike {
  if (typeof globalThis.fetch !== 'function') {
    throw new Error('Supabase RPC client requires a fetch implementation in the backend runtime.');
  }

  return globalThis.fetch.bind(globalThis) as SupabaseRpcFetcherLike;
}

async function parseSupabaseRpcBody(response: SupabaseRpcFetchResponseLike): Promise<unknown> {
  if (response.text) {
    const text = await readSupabaseRpcText(response);
    if (text === null || text.length === 0) {
      return null;
    }

    try {
      return JSON.parse(text);
    } catch (_parseError) {
      return text;
    }
  }

  if (!response.json) {
    return null;
  }

  try {
    return await response.json();
  } catch (_jsonError) {
    return null;
  }
}

async function readSupabaseRpcText(response: SupabaseRpcFetchResponseLike): Promise<string | null> {
  try {
    return await response.text?.();
  } catch (_textError) {
    return null;
  }
}

function requireSupabaseEmbeddingDimensions(embedding: readonly number[]): void {
  if (embedding.length !== SUPABASE_PGVECTOR_EMBEDDING_DIMENSIONS) {
    throw new Error(SUPABASE_PGVECTOR_DIMENSION_ERROR);
  }
}

function toJsonObject(metadata: Record<string, unknown> | undefined): JsonObject | undefined {
  if (!metadata) {
    return undefined;
  }

  const projected: JsonObject = {};
  for (const [key, value] of Object.entries(metadata)) {
    const jsonValue = toJsonValue(value);
    if (jsonValue !== undefined) {
      projected[key] = jsonValue;
    }
  }

  return projected;
}

function toJsonValue(value: unknown): JsonValue | undefined {
  if (value === null) {
    return null;
  }
  if (typeof value === 'string' || typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }
  if (Array.isArray(value)) {
    const items = value.map(toJsonValue).filter((item): item is JsonValue => item !== undefined);
    return items;
  }
  if (isPlainRecord(value)) {
    return toJsonObject(value);
  }

  return undefined;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
