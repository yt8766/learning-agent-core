import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';

import { ModelInvocationFacade } from '@agent/runtime';
import type { KnowledgeSearchService, VectorSearchProvider } from '@agent/knowledge';

import { RuntimeHost } from '../../../src/runtime/core/runtime.host';

type InvocationRequest = Parameters<ModelInvocationFacade['invoke']>[0];

const ORIGINAL_ENV = { ...process.env };

describe('RuntimeHost invocation request shape', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    process.env = { ...ORIGINAL_ENV };
  });

  it('exposes context hints on facade invocation requests', () => {
    expectTypeOf<InvocationRequest['contextHints']>().toEqualTypeOf<Record<string, unknown>>();
    expect(true).toBe(true);
  });

  it('accepts an explicit knowledge vector provider for hybrid search wiring', () => {
    const vectorProvider: VectorSearchProvider = {
      searchSimilar: async () => []
    };
    const host = new RuntimeHost({ knowledgeVectorSearchProvider: vectorProvider });

    expect(host.knowledgeVectorSearchProvider).toBe(vectorProvider);
  });

  it('accepts an explicit keyword search service for runtime knowledge search wiring', async () => {
    const keywordService: KnowledgeSearchService = {
      search: async request => ({
        hits: [],
        total: 0,
        query: request.query
      })
    };
    const host = new RuntimeHost({ keywordSearchService: keywordService });

    const result = await host.knowledgeSearchService.search({ query: 'custom keyword service', limit: 5 });

    expect(host.knowledgeSearchService).toBe(keywordService);
    expect(result).toMatchObject({ query: 'custom keyword service' });
  });

  it('passes explicit keyword search service into the main runtime knowledge entry', async () => {
    const keywordService: KnowledgeSearchService = {
      search: async request => ({
        hits: [
          {
            chunkId: 'main-chain-hit',
            documentId: 'doc-1',
            sourceId: 'source-1',
            uri: '/docs/main.md',
            title: 'Main Chain',
            sourceType: 'repo-docs',
            trustClass: 'internal',
            content: `main chain saw ${request.query}`,
            score: 1,
            citation: {
              sourceId: 'source-1',
              chunkId: 'main-chain-hit',
              title: 'Main Chain',
              uri: '/docs/main.md'
            }
          }
        ],
        total: 1,
        diagnostics: {
          retrievalMode: 'keyword-only',
          candidateCount: 1
        }
      })
    };
    const host = new RuntimeHost({ keywordSearchService: keywordService });

    const hits = await host.runtime.knowledgeSearchService.search('main chain query', 5);

    expect(hits).toEqual([
      expect.objectContaining({
        chunkId: 'main-chain-hit',
        content: 'main chain saw main chain query'
      })
    ]);
    expect(host.runtime.knowledgeSearchService.getLastDiagnostics?.()).toMatchObject({
      query: 'main chain query',
      limit: 5,
      hitCount: 1,
      total: 1,
      diagnostics: {
        retrievalMode: 'keyword-only',
        candidateCount: 1
      }
    });
  });

  it('composes explicit keyword and vector options into hybrid runtime knowledge search', async () => {
    const keywordService: KnowledgeSearchService = {
      search: async () => ({
        hits: [],
        total: 0
      })
    };
    const vectorProvider: VectorSearchProvider = {
      searchSimilar: async () => []
    };
    const host = new RuntimeHost({
      keywordSearchService: keywordService,
      knowledgeVectorSearchProvider: vectorProvider
    });

    const result = await host.knowledgeSearchService.search({ query: 'hybrid runtime option', limit: 5 });

    expect(host.knowledgeSearchService).not.toBe(keywordService);
    expect(result).toHaveProperty('diagnostics.retrievalMode', 'hybrid');
    expect(host.knowledgeSearchStatus).toMatchObject({
      configuredMode: 'hybrid',
      effectiveMode: 'hybrid',
      vectorConfigured: true,
      hybridEnabled: true
    });
  });

  it('creates a configured Chroma vector provider from production env secrets', () => {
    vi.stubEnv('KNOWLEDGE_RETRIEVAL_MODE', 'hybrid');
    vi.stubEnv('KNOWLEDGE_VECTOR_PROVIDER', 'chroma');
    vi.stubEnv('KNOWLEDGE_CHROMA_COLLECTION', 'runtime-knowledge');
    vi.stubEnv('KNOWLEDGE_CHROMA_ENDPOINT', 'https://chroma.example.com');
    vi.stubEnv('KNOWLEDGE_EMBEDDINGS_ENDPOINT', 'https://embeddings.example.com/v1');
    vi.stubEnv('KNOWLEDGE_EMBEDDINGS_MODEL', 'embedding-3');
    vi.stubEnv('KNOWLEDGE_EMBEDDINGS_API_KEY', 'secret-from-env');
    vi.stubEnv('KNOWLEDGE_PROVIDER_HEALTH_TTL_MS', '2500');
    vi.stubEnv('KNOWLEDGE_PROVIDER_HEALTH_TIMEOUT_MS', '700');

    const host = new RuntimeHost();

    expect(host.knowledgeVectorSearchProvider).toBeDefined();
    expect(host.knowledgeSearchStatus).toMatchObject({
      configuredMode: 'hybrid',
      effectiveMode: 'hybrid',
      vectorProviderId: 'chroma',
      vectorConfigured: true,
      hybridEnabled: true
    });
  });
});
