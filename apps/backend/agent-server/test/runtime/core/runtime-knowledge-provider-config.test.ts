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

  it('returns empty config when no env vars are set', () => {
    const options = createRuntimeKnowledgeProviderOptionsFromEnv({});
    expect(options.config).toBeUndefined();
    expect(options.keywordSearchService).toBeUndefined();
  });

  it('ignores invalid retrieval mode', () => {
    const options = createRuntimeKnowledgeProviderOptionsFromEnv({
      KNOWLEDGE_RETRIEVAL_MODE: 'invalid-mode'
    });
    expect(options.config).toBeUndefined();
  });

  it('parses keyword-only retrieval mode', () => {
    const options = createRuntimeKnowledgeProviderOptionsFromEnv({
      KNOWLEDGE_RETRIEVAL_MODE: 'keyword-only'
    });
    expect(options.config?.retrievalMode).toBe('keyword-only');
  });

  it('parses vector-only retrieval mode', () => {
    const options = createRuntimeKnowledgeProviderOptionsFromEnv({
      KNOWLEDGE_RETRIEVAL_MODE: 'vector-only'
    });
    expect(options.config?.retrievalMode).toBe('vector-only');
  });

  it('parses boolean env true values', () => {
    const options = createRuntimeKnowledgeProviderOptionsFromEnv({
      KNOWLEDGE_VECTOR_ENABLED: 'true'
    });
    expect(options.config?.vector?.enabled).toBe(true);
  });

  it('parses boolean env false values', () => {
    const options = createRuntimeKnowledgeProviderOptionsFromEnv({
      KNOWLEDGE_VECTOR_ENABLED: 'false'
    });
    // vector section not added when explicitly false and no vectorProviderId
    expect(options.config?.vector).toBeUndefined();
  });

  it('parses boolean env 1/0 values', () => {
    const options1 = createRuntimeKnowledgeProviderOptionsFromEnv({
      KNOWLEDGE_VECTOR_ENABLED: '1'
    });
    expect(options1.config?.vector?.enabled).toBe(true);

    const options2 = createRuntimeKnowledgeProviderOptionsFromEnv({
      KNOWLEDGE_VECTOR_ENABLED: '0'
    });
    expect(options2.config?.vector).toBeUndefined();
  });

  it('parses boolean env yes/no values', () => {
    const options1 = createRuntimeKnowledgeProviderOptionsFromEnv({
      KNOWLEDGE_VECTOR_ENABLED: 'yes'
    });
    expect(options1.config?.vector?.enabled).toBe(true);

    const options2 = createRuntimeKnowledgeProviderOptionsFromEnv({
      KNOWLEDGE_VECTOR_ENABLED: 'no'
    });
    expect(options2.config?.vector).toBeUndefined();
  });

  it('ignores invalid boolean env', () => {
    const options = createRuntimeKnowledgeProviderOptionsFromEnv({
      KNOWLEDGE_VECTOR_ENABLED: 'maybe'
    });
    expect(options.config?.vector).toBeUndefined();
  });

  it('ignores negative health ttl', () => {
    const options = createRuntimeKnowledgeProviderOptionsFromEnv({
      KNOWLEDGE_PROVIDER_HEALTH_TTL_MS: '-100'
    });
    expect(options.config?.health).toBeUndefined();
  });

  it('ignores non-integer health values', () => {
    const options = createRuntimeKnowledgeProviderOptionsFromEnv({
      KNOWLEDGE_PROVIDER_HEALTH_TTL_MS: 'abc'
    });
    expect(options.config?.health).toBeUndefined();
  });

  it('ignores zero for positive integer env', () => {
    const options = createRuntimeKnowledgeProviderOptionsFromEnv({
      KNOWLEDGE_PROVIDER_HEALTH_TIMEOUT_MS: '0'
    });
    expect(options.config?.health).toBeUndefined();
  });

  it('handles health config with only degradedAfterConsecutiveFailures', () => {
    const options = createRuntimeKnowledgeProviderOptionsFromEnv({
      KNOWLEDGE_PROVIDER_HEALTH_DEGRADED_AFTER_FAILURES: '3'
    });
    expect(options.config?.health).toEqual({ degradedAfterConsecutiveFailures: 3 });
  });

  it('creates OpenSearch keyword provider without API key', () => {
    const options = createRuntimeKnowledgeProviderOptionsFromEnv({
      KNOWLEDGE_KEYWORD_PROVIDER: 'opensearch',
      KNOWLEDGE_OPENSEARCH_ENDPOINT: 'https://opensearch.example.com',
      KNOWLEDGE_OPENSEARCH_INDEX: 'knowledge-chunks'
    });
    expect(options.keywordSearchService).toBeDefined();
  });

  it('does not create OpenSearch when endpoint is missing', () => {
    const options = createRuntimeKnowledgeProviderOptionsFromEnv({
      KNOWLEDGE_KEYWORD_PROVIDER: 'opensearch',
      KNOWLEDGE_OPENSEARCH_INDEX: 'knowledge-chunks'
    });
    expect(options.keywordSearchService).toBeUndefined();
  });

  it('does not create OpenSearch when index is missing', () => {
    const options = createRuntimeKnowledgeProviderOptionsFromEnv({
      KNOWLEDGE_KEYWORD_PROVIDER: 'opensearch',
      KNOWLEDGE_OPENSEARCH_ENDPOINT: 'https://opensearch.example.com'
    });
    expect(options.keywordSearchService).toBeUndefined();
  });

  it('ignores unknown keyword provider', () => {
    const options = createRuntimeKnowledgeProviderOptionsFromEnv({
      KNOWLEDGE_KEYWORD_PROVIDER: 'unknown'
    });
    expect(options.keywordSearchService).toBeUndefined();
  });

  it('handles non-chroma vector provider', () => {
    const options = createRuntimeKnowledgeProviderOptionsFromEnv({
      KNOWLEDGE_VECTOR_PROVIDER: 'pinecone'
    });
    expect(options.config?.vector?.providerId).toBe('pinecone');
    expect(options.knowledgeVectorSearchProvider).toBeUndefined();
  });

  it('trims whitespace from env values', () => {
    const options = createRuntimeKnowledgeProviderOptionsFromEnv({
      KNOWLEDGE_RETRIEVAL_MODE: '  hybrid  '
    });
    expect(options.config?.retrievalMode).toBe('hybrid');
  });

  it('ignores empty string env values', () => {
    const options = createRuntimeKnowledgeProviderOptionsFromEnv({
      KNOWLEDGE_RETRIEVAL_MODE: '   '
    });
    expect(options.config).toBeUndefined();
  });

  it('uses env-based default retrieval mode for chroma', () => {
    const options = createRuntimeKnowledgeProviderOptionsFromEnv({
      KNOWLEDGE_VECTOR_PROVIDER: 'chroma',
      KNOWLEDGE_CHROMA_COLLECTION: 'test',
      KNOWLEDGE_EMBEDDINGS_ENDPOINT: 'https://embed.example.com',
      KNOWLEDGE_EMBEDDINGS_MODEL: 'embed-model'
    });
    expect(options.config?.retrievalMode).toBe('hybrid');
  });

  it('creates chroma with embeddings dimensions', () => {
    createRuntimeKnowledgeProviderOptionsFromEnv({
      KNOWLEDGE_VECTOR_PROVIDER: 'chroma',
      KNOWLEDGE_CHROMA_COLLECTION: 'test',
      KNOWLEDGE_EMBEDDINGS_ENDPOINT: 'https://embed.example.com',
      KNOWLEDGE_EMBEDDINGS_MODEL: 'embed-model',
      KNOWLEDGE_EMBEDDINGS_DIMENSIONS: '768'
    });
    expect(createRuntimeEmbeddingProviderMock).toHaveBeenCalledWith(
      expect.objectContaining({
        embeddings: expect.objectContaining({
          dimensions: 768
        })
      })
    );
  });
});
