import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { KnowledgeChunk, KnowledgeSearchService, KnowledgeSource, VectorSearchProvider } from '@agent/knowledge';

const listKnowledgeArtifactsMock = vi.hoisted(() => vi.fn());

vi.mock('@agent/knowledge', async importOriginal => {
  const actual = await importOriginal<typeof import('@agent/knowledge')>();
  return {
    ...actual,
    listKnowledgeArtifacts: listKnowledgeArtifactsMock
  };
});

import {
  createRuntimeKnowledgeProviderFactory,
  createRuntimeKnowledgeSearchStatus,
  createRuntimeKnowledgeSearchService
} from '../../../src/runtime/core/runtime-knowledge-search-factory';

const source: KnowledgeSource = {
  id: 'source-1',
  sourceType: 'repo-docs',
  uri: 'docs/search.md',
  title: 'Hybrid Search Notes',
  trustClass: 'internal',
  updatedAt: '2026-04-30T00:00:00.000Z'
};

const keywordChunk: KnowledgeChunk = {
  id: 'chunk-keyword',
  sourceId: source.id,
  documentId: 'doc-1',
  chunkIndex: 0,
  content: '精确型号 HX-9000 使用 keyword path 命中。',
  searchable: true,
  updatedAt: '2026-04-30T00:00:00.000Z'
};

const vectorChunk: KnowledgeChunk = {
  id: 'chunk-vector',
  sourceId: source.id,
  documentId: 'doc-1',
  chunkIndex: 1,
  content: '语义近义描述会通过 vector provider 命中。',
  searchable: true,
  updatedAt: '2026-04-30T00:00:00.000Z'
};

describe('runtime knowledge search factory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listKnowledgeArtifactsMock.mockResolvedValue({
      sources: [source],
      chunks: [keywordChunk, vectorChunk],
      stores: [],
      embeddings: [],
      receipts: []
    });
  });

  it('keeps keyword-only search service when no vector provider is configured', async () => {
    const searchService = createRuntimeKnowledgeSearchService({
      settings: { workspaceRoot: '/tmp/workspace', knowledgeRoot: '/tmp/workspace/data/knowledge' }
    });

    const result = await searchService.search({ query: 'HX-9000', limit: 5 });

    expect(result.hits.map(hit => hit.chunkId)).toEqual(['chunk-keyword']);
    expect(result).not.toHaveProperty('diagnostics.hybrid');
  });

  it('uses an explicit keyword search service when no vector provider is configured', async () => {
    const keywordService: KnowledgeSearchService = {
      search: vi.fn(async () => ({
        hits: [],
        total: 0
      }))
    };

    const searchService = createRuntimeKnowledgeSearchService({
      settings: { workspaceRoot: '/tmp/workspace', knowledgeRoot: '/tmp/workspace/data/knowledge' },
      keywordSearchService: keywordService
    });

    await searchService.search({ query: 'custom keyword path', limit: 5 });

    expect(searchService).toBe(keywordService);
    expect(keywordService.search).toHaveBeenCalledWith({ query: 'custom keyword path', limit: 5 });
    expect(listKnowledgeArtifactsMock).not.toHaveBeenCalled();
  });

  it('wires HybridKnowledgeSearchService when the host provides a vector provider', async () => {
    const vectorProvider: VectorSearchProvider = {
      searchSimilar: vi.fn(async () => [{ chunkId: vectorChunk.id, score: 0.92 }])
    };
    const searchService = createRuntimeKnowledgeSearchService({
      settings: { workspaceRoot: '/tmp/workspace', knowledgeRoot: '/tmp/workspace/data/knowledge' },
      knowledgeVectorSearchProvider: vectorProvider
    });

    const result = await searchService.search({ query: 'HX-9000 语义近义', limit: 5 });

    expect(vectorProvider.searchSimilar).toHaveBeenCalledWith(
      'HX-9000 语义近义',
      15,
      expect.objectContaining({ filters: expect.any(Object) })
    );
    expect(result.hits.map(hit => hit.chunkId)).toContain('chunk-keyword');
    expect(result.hits.map(hit => hit.chunkId)).toContain('chunk-vector');
    expect(result).toHaveProperty('diagnostics.retrievalMode', 'hybrid');
  });

  it('composes an explicit keyword service with a vector provider for hybrid search', async () => {
    const keywordService: KnowledgeSearchService = {
      search: vi.fn(async () => ({
        hits: [],
        total: 0
      }))
    };
    const vectorProvider: VectorSearchProvider = {
      searchSimilar: vi.fn(async () => [])
    };
    const searchService = createRuntimeKnowledgeSearchService({
      settings: { workspaceRoot: '/tmp/workspace', knowledgeRoot: '/tmp/workspace/data/knowledge' },
      keywordSearchService: keywordService,
      knowledgeVectorSearchProvider: vectorProvider
    });

    const result = await searchService.search({ query: 'hybrid custom service', limit: 5 });

    expect(searchService).not.toBe(keywordService);
    expect(keywordService.search).toHaveBeenCalledWith({ query: 'hybrid custom service', limit: 5 });
    expect(vectorProvider.searchSimilar).toHaveBeenCalledWith(
      'hybrid custom service',
      15,
      expect.objectContaining({ filters: expect.any(Object) })
    );
    expect(result).toHaveProperty('diagnostics.retrievalMode', 'hybrid');
  });

  it('builds keyword, vector, and hybrid services from an explicit config object and provider instance', async () => {
    const keywordService: KnowledgeSearchService = {
      search: vi.fn(async () => ({
        hits: [],
        total: 0
      }))
    };
    const vectorProvider: VectorSearchProvider = {
      searchSimilar: vi.fn(async () => [])
    };

    const factory = createRuntimeKnowledgeProviderFactory({
      config: {
        knowledgeRoot: '/tmp/workspace/data/knowledge',
        retrievalMode: 'hybrid',
        vector: {
          enabled: true,
          providerId: 'in-memory-test'
        }
      },
      settings: { workspaceRoot: '/tmp/workspace', knowledgeRoot: '/tmp/workspace/data/knowledge' },
      keywordSearchService: keywordService,
      knowledgeVectorSearchProvider: vectorProvider
    });

    expect(factory.keywordSearchService).toBe(keywordService);
    expect(factory.vectorSearchProvider).toBe(vectorProvider);
    expect(factory.hybridSearchService).toBe(factory.searchService);
    expect(factory.diagnostics).toEqual([
      {
        code: 'knowledge.vector_provider.ready',
        severity: 'info',
        message: 'Knowledge vector provider "in-memory-test" was supplied explicitly.'
      },
      {
        code: 'knowledge.retrieval.hybrid.ready',
        severity: 'info',
        message: 'Knowledge hybrid search is enabled with keyword and vector providers.'
      }
    ]);

    await factory.searchService.search({ query: 'hybrid explicit config', limit: 5 });

    expect(keywordService.search).toHaveBeenCalledWith({ query: 'hybrid explicit config', limit: 5 });
    expect(vectorProvider.searchSimilar).toHaveBeenCalledWith(
      'hybrid explicit config',
      15,
      expect.objectContaining({ filters: expect.any(Object) })
    );
  });

  it('keeps keyword-only search with diagnostics when vector config is enabled but no client is supplied', async () => {
    const keywordService: KnowledgeSearchService = {
      search: vi.fn(async () => ({
        hits: [],
        total: 0
      }))
    };

    const factory = createRuntimeKnowledgeProviderFactory({
      config: {
        knowledgeRoot: '/tmp/workspace/data/knowledge',
        retrievalMode: 'hybrid',
        vector: {
          enabled: true,
          providerId: 'missing-client'
        }
      },
      settings: { workspaceRoot: '/tmp/workspace', knowledgeRoot: '/tmp/workspace/data/knowledge' },
      keywordSearchService: keywordService
    });

    expect(factory.searchService).toBe(keywordService);
    expect(factory.vectorSearchProvider).toBeUndefined();
    expect(factory.hybridSearchService).toBeUndefined();
    expect(factory.diagnostics).toEqual([
      {
        code: 'knowledge.vector_provider.missing_client',
        severity: 'warning',
        message:
          'Knowledge vector provider "missing-client" is enabled, but no explicit provider/client instance was supplied; falling back to keyword-only search.'
      }
    ]);
    expect(createRuntimeKnowledgeSearchStatus(factory, '2026-05-01T00:00:00.000Z')).toEqual({
      configuredMode: 'hybrid',
      effectiveMode: 'keyword-only',
      vectorProviderId: 'missing-client',
      vectorConfigured: true,
      hybridEnabled: false,
      vectorProviderHealth: {
        status: 'unknown',
        checkedAt: '2026-05-01T00:00:00.000Z',
        message: 'Vector provider does not expose a health check.'
      },
      diagnostics: factory.diagnostics,
      checkedAt: '2026-05-01T00:00:00.000Z'
    });
  });

  it('builds vector-only search from an explicit config object and vector provider', async () => {
    const vectorProvider: VectorSearchProvider = {
      searchSimilar: vi.fn(async () => [{ chunkId: vectorChunk.id, score: 0.8 }])
    };

    const factory = createRuntimeKnowledgeProviderFactory({
      config: {
        retrievalMode: 'vector-only',
        vector: {
          enabled: true,
          providerId: 'vector-only-test'
        }
      },
      settings: { workspaceRoot: '/tmp/workspace', knowledgeRoot: '/tmp/workspace/data/knowledge' },
      knowledgeVectorSearchProvider: vectorProvider
    });

    const result = await factory.searchService.search({ query: 'semantic vector only', limit: 5 });

    expect(factory.hybridSearchService).toBeUndefined();
    expect(factory.vectorSearchProvider).toBe(vectorProvider);
    expect(result.hits.map(hit => hit.chunkId)).toEqual(['chunk-vector']);
    expect(factory.diagnostics).toEqual([
      {
        code: 'knowledge.vector_provider.ready',
        severity: 'info',
        message: 'Knowledge vector provider "vector-only-test" was supplied explicitly.'
      },
      {
        code: 'knowledge.retrieval.vector_only.ready',
        severity: 'info',
        message: 'Knowledge vector-only search is enabled with an explicit vector provider.'
      }
    ]);
    expect(createRuntimeKnowledgeSearchStatus(factory, '2026-05-01T00:00:00.000Z')).toMatchObject({
      configuredMode: 'vector-only',
      effectiveMode: 'vector-only',
      vectorProviderId: 'vector-only-test',
      vectorConfigured: true,
      hybridEnabled: false,
      vectorProviderHealth: {
        status: 'unknown',
        checkedAt: '2026-05-01T00:00:00.000Z',
        message: 'Vector provider health has not been checked yet.'
      }
    });
  });
});
