import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  chromaVectorSearchProviderMock,
  createOpenSearchKeywordSearchProviderMock,
  createRuntimeEmbeddingProviderMock
} = vi.hoisted(() => ({
  chromaVectorSearchProviderMock: vi.fn(function (this: unknown, options: unknown) {
    return {
      kind: 'chroma-vector-provider',
      options,
      searchSimilar: vi.fn(async () => [])
    };
  }),
  createOpenSearchKeywordSearchProviderMock: vi.fn(function (this: unknown, options: unknown) {
    return {
      kind: 'opensearch-keyword-provider',
      options,
      search: vi.fn(async () => ({ hits: [], total: 0 })),
      healthCheck: vi.fn(async () => ({ status: 'healthy' as const, message: 'keyword reachable' }))
    };
  }),
  createRuntimeEmbeddingProviderMock: vi.fn(() => ({
    embedQuery: vi.fn(async () => [0.1, 0.2, 0.3])
  }))
}));

vi.mock('@agent/knowledge', async importOriginal => ({
  ...(await importOriginal<typeof import('@agent/knowledge')>()),
  ChromaVectorSearchProvider: chromaVectorSearchProviderMock,
  createOpenSearchKeywordSearchProvider: createOpenSearchKeywordSearchProviderMock
}));

vi.mock('@agent/adapters', () => ({
  createRuntimeEmbeddingProvider: createRuntimeEmbeddingProviderMock
}));

import { createRuntimeKnowledgeProviderOptionsFromEnv } from '../../../src/runtime/core/runtime-knowledge-provider-config';

describe('runtime knowledge provider config', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a Chroma vector provider from env and passes embedding secrets through the adapter boundary', () => {
    const options = createRuntimeKnowledgeProviderOptionsFromEnv({
      KNOWLEDGE_RETRIEVAL_MODE: 'hybrid',
      KNOWLEDGE_VECTOR_PROVIDER: 'chroma',
      KNOWLEDGE_CHROMA_COLLECTION: 'runtime-knowledge',
      KNOWLEDGE_CHROMA_ENDPOINT: 'https://chroma.example.com',
      KNOWLEDGE_CHROMA_API_KEY: 'chroma-secret',
      KNOWLEDGE_EMBEDDINGS_ENDPOINT: 'https://embeddings.example.com/v1',
      KNOWLEDGE_EMBEDDINGS_MODEL: 'embedding-3',
      KNOWLEDGE_EMBEDDINGS_API_KEY: 'embedding-secret',
      KNOWLEDGE_PROVIDER_HEALTH_TTL_MS: '2500',
      KNOWLEDGE_PROVIDER_HEALTH_TIMEOUT_MS: '700'
    });

    expect(createRuntimeEmbeddingProviderMock).toHaveBeenCalledWith({
      embeddings: {
        endpoint: 'https://embeddings.example.com/v1',
        model: 'embedding-3',
        dimensions: undefined,
        apiKey: 'embedding-secret'
      },
      zhipuApiKey: undefined,
      mcp: {
        bigmodelApiKey: undefined
      }
    });
    expect(chromaVectorSearchProviderMock).toHaveBeenCalledWith(
      expect.objectContaining({
        collectionName: 'runtime-knowledge',
        clientOptions: {
          path: 'https://chroma.example.com',
          fetchOptions: {
            headers: {
              Authorization: 'Bearer chroma-secret'
            }
          }
        },
        embeddingProvider: expect.objectContaining({
          embedQuery: expect.any(Function)
        })
      })
    );
    expect(options).toMatchObject({
      config: {
        retrievalMode: 'hybrid',
        vector: {
          enabled: true,
          providerId: 'chroma'
        },
        health: {
          ttlMs: 2500,
          timeoutMs: 700
        }
      },
      knowledgeVectorSearchProvider: {
        kind: 'chroma-vector-provider'
      }
    });
  });

  it('keeps vector configured but fake-safe when Chroma env is incomplete', () => {
    const options = createRuntimeKnowledgeProviderOptionsFromEnv({
      KNOWLEDGE_RETRIEVAL_MODE: 'hybrid',
      KNOWLEDGE_VECTOR_PROVIDER: 'chroma'
    });

    expect(options.config).toMatchObject({
      retrievalMode: 'hybrid',
      vector: {
        enabled: true,
        providerId: 'chroma'
      }
    });
    expect(options.knowledgeVectorSearchProvider).toBeUndefined();
    expect(chromaVectorSearchProviderMock).not.toHaveBeenCalled();
  });

  it('creates an OpenSearch keyword provider from env without leaking SDK details to runtime host', async () => {
    const options = createRuntimeKnowledgeProviderOptionsFromEnv({
      KNOWLEDGE_RETRIEVAL_MODE: 'hybrid',
      KNOWLEDGE_KEYWORD_PROVIDER: 'opensearch',
      KNOWLEDGE_OPENSEARCH_ENDPOINT: 'https://opensearch.example.com',
      KNOWLEDGE_OPENSEARCH_INDEX: 'knowledge-chunks',
      KNOWLEDGE_OPENSEARCH_API_KEY: 'opensearch-secret'
    });

    expect(createOpenSearchKeywordSearchProviderMock).toHaveBeenCalledWith(
      expect.objectContaining({
        indexName: 'knowledge-chunks',
        client: expect.objectContaining({
          search: expect.any(Function)
        })
      })
    );
    expect(options).toMatchObject({
      config: {
        retrievalMode: 'hybrid',
        keyword: {
          providerId: 'opensearch'
        }
      },
      keywordSearchService: {
        kind: 'opensearch-keyword-provider'
      }
    });

    expect(createOpenSearchKeywordSearchProviderMock.mock.calls[0]?.[0]?.client).not.toHaveProperty('endpoint');
  });
});
