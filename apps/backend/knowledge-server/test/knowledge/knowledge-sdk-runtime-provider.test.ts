import { Test } from '@nestjs/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { KNOWLEDGE_SDK_RUNTIME } from '../../src/knowledge/knowledge.tokens';
import { KnowledgeModule } from '../../src/knowledge/knowledge.module';
import { KNOWLEDGE_SCHEMA_SQL } from '../../src/knowledge/runtime/knowledge-schema.sql';

const { createDefaultKnowledgeSdkRuntime } = vi.hoisted(() => ({
  createDefaultKnowledgeSdkRuntime: vi.fn(config => ({
    chatProvider: { providerId: config.chat.provider, defaultModel: config.chat.model },
    embeddingProvider: {
      providerId: config.embedding.provider,
      defaultModel: config.embedding.model,
      dimensions: config.embedding.dimensions
    },
    vectorStore: { client: config.vectorStore.client }
  }))
}));

vi.mock('@agent/knowledge/node', () => ({
  createDefaultKnowledgeSdkRuntime
}));

import {
  createKnowledgeSdkRuntimeProvider,
  createPostgresKnowledgeSdkRpcClient
} from '../../src/knowledge/runtime/knowledge-sdk-runtime.provider';

function completeEnv() {
  return {
    DATABASE_URL: 'postgres://user:pass@localhost:5432/knowledge',
    KNOWLEDGE_CHAT_MODEL: 'gpt-4.1-mini',
    KNOWLEDGE_EMBEDDING_MODEL: 'text-embedding-3-small',
    KNOWLEDGE_LLM_API_KEY: 'test-key',
    KNOWLEDGE_LLM_BASE_URL: 'https://llm.local/v1',
    KNOWLEDGE_CHAT_MAX_TOKENS: '1200',
    KNOWLEDGE_EMBEDDING_DIMENSIONS: '1024'
  };
}

describe('createKnowledgeSdkRuntimeProvider', () => {
  afterEach(() => {
    createDefaultKnowledgeSdkRuntime.mockClear();
    vi.unstubAllEnvs();
  });

  it('returns disabled when DATABASE_URL is absent', async () => {
    const provider = createKnowledgeSdkRuntimeProvider({
      env: {
        KNOWLEDGE_EMBEDDING_MODEL: 'text-embedding-3-small'
      }
    });

    await expect(provider.useFactory()).resolves.toEqual({
      enabled: false,
      reason: 'missing_env',
      missingEnv: ['DATABASE_URL', 'KNOWLEDGE_CHAT_MODEL', 'KNOWLEDGE_LLM_API_KEY'],
      runtime: null
    });
    expect(createDefaultKnowledgeSdkRuntime).not.toHaveBeenCalled();
  });

  it('returns disabled when only DATABASE_URL is configured for the repository', async () => {
    const provider = createKnowledgeSdkRuntimeProvider({
      env: {
        DATABASE_URL: 'postgres://user:pass@localhost:5432/knowledge'
      }
    });

    await expect(provider.useFactory()).resolves.toMatchObject({
      enabled: false,
      reason: 'missing_env',
      missingEnv: ['KNOWLEDGE_CHAT_MODEL', 'KNOWLEDGE_EMBEDDING_MODEL', 'KNOWLEDGE_LLM_API_KEY'],
      runtime: null
    });
    expect(createDefaultKnowledgeSdkRuntime).not.toHaveBeenCalled();
  });

  it('initializes schema and creates the default SDK runtime when env is complete', async () => {
    const queries: Array<{ sql: string; values?: unknown[] }> = [];
    const provider = createKnowledgeSdkRuntimeProvider({
      env: completeEnv(),
      createClient: () => ({
        query: async (sql, values) => {
          queries.push({ sql, values });
          return { rows: [] };
        }
      })
    });

    const result = await provider.useFactory();

    expect(result.enabled).toBe(true);
    expect(result.runtime).toEqual({
      chatProvider: { providerId: 'openai-compatible', defaultModel: 'gpt-4.1-mini' },
      embeddingProvider: {
        providerId: 'openai-compatible',
        defaultModel: 'text-embedding-3-small',
        dimensions: 1024
      },
      vectorStore: expect.any(Object)
    });
    expect(queries[0]?.sql).toBe(KNOWLEDGE_SCHEMA_SQL);
    expect(createDefaultKnowledgeSdkRuntime).toHaveBeenCalledWith({
      chat: {
        provider: 'openai-compatible',
        apiKey: 'test-key',
        model: 'gpt-4.1-mini',
        baseURL: 'https://llm.local/v1',
        maxTokens: 1200
      },
      embedding: {
        provider: 'openai-compatible',
        apiKey: 'test-key',
        model: 'text-embedding-3-small',
        baseURL: 'https://llm.local/v1',
        dimensions: 1024
      },
      vectorStore: { client: expect.objectContaining({ rpc: expect.any(Function) }) }
    });
  });

  it('fails fast when partial SDK env is missing required values', async () => {
    const provider = createKnowledgeSdkRuntimeProvider({
      env: {
        DATABASE_URL: 'postgres://user:pass@localhost:5432/knowledge',
        KNOWLEDGE_CHAT_MODEL: 'gpt-4.1-mini',
        KNOWLEDGE_LLM_API_KEY: 'test-key'
      },
      createClient: () => ({
        query: async () => ({ rows: [] })
      })
    });

    await expect(provider.useFactory()).rejects.toMatchObject({
      name: 'KnowledgeSdkRuntimeProviderConfigError',
      missingEnv: ['KNOWLEDGE_EMBEDDING_MODEL']
    });
  });

  it('registers the SDK runtime provider in KnowledgeModule', async () => {
    vi.stubEnv('DATABASE_URL', '');
    vi.stubEnv('KNOWLEDGE_CHAT_MODEL', '');
    vi.stubEnv('KNOWLEDGE_EMBEDDING_MODEL', '');
    vi.stubEnv('KNOWLEDGE_LLM_API_KEY', '');

    const moduleRef = await Test.createTestingModule({ imports: [KnowledgeModule] }).compile();

    expect(moduleRef.get(KNOWLEDGE_SDK_RUNTIME)).toMatchObject({ enabled: false, runtime: null });
  });
});

describe('createPostgresKnowledgeSdkRpcClient', () => {
  it('maps upsert/search/delete RPC calls to postgres function SQL and args', async () => {
    const queries: Array<{ sql: string; values?: unknown[] }> = [];
    const client = createPostgresKnowledgeSdkRpcClient({
      query: async (sql, values) => {
        queries.push({ sql, values });
        if (sql.includes('upsert_knowledge_chunks')) {
          return { rows: [{ upserted_count: 2 }] };
        }
        if (sql.includes('match_knowledge_chunks')) {
          return {
            rows: [
              {
                chunk_id: 'chunk_1',
                document_id: 'doc_1',
                text: 'hello',
                score: 0.9,
                metadata: { tag: 'a' }
              }
            ]
          };
        }
        return { rows: [{ deleted_count: 1 }] };
      }
    });

    await expect(
      client.rpc('upsert_knowledge_chunks', {
        tenant_id: 'tenant_1',
        knowledge_base_id: 'kb_1',
        document_id: 'doc_1',
        records: [{ chunk_id: 'chunk_1', text: 'hello', embedding: [0.1], metadata: {} }]
      })
    ).resolves.toEqual({ data: { upserted_count: 2 }, error: null });
    await expect(
      client.rpc('match_knowledge_chunks', {
        tenant_id: 'tenant_1',
        knowledge_base_id: 'kb_1',
        query_text: 'hello',
        embedding: [0.1],
        top_k: 5,
        filters: { document_ids: ['doc_1'] }
      })
    ).resolves.toEqual({
      data: [{ chunk_id: 'chunk_1', document_id: 'doc_1', text: 'hello', score: 0.9, metadata: { tag: 'a' } }],
      error: null
    });
    await expect(
      client.rpc('delete_knowledge_document_chunks', {
        tenant_id: 'tenant_1',
        knowledge_base_id: 'kb_1',
        document_id: 'doc_1'
      })
    ).resolves.toEqual({ data: { deleted_count: 1 }, error: null });

    expect(queries).toEqual([
      {
        sql: 'select * from upsert_knowledge_chunks($1, $2, $3::jsonb, $4)',
        values: [
          'kb_1',
          'doc_1',
          JSON.stringify([{ chunk_id: 'chunk_1', text: 'hello', embedding: [0.1], metadata: {} }]),
          'tenant_1'
        ]
      },
      {
        sql: 'select * from match_knowledge_chunks($1, $2::vector, $3, $4, $5::jsonb, $6)',
        values: ['kb_1', '[0.1]', 5, 'hello', JSON.stringify({ document_ids: ['doc_1'] }), 'tenant_1']
      },
      {
        sql: 'select * from delete_knowledge_document_chunks($1, $2, $3)',
        values: ['kb_1', 'doc_1', 'tenant_1']
      }
    ]);
  });
});
