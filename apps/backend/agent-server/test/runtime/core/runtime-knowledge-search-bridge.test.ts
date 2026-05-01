import { describe, expect, it, vi } from 'vitest';

import type { KnowledgeChunk, KnowledgeSearchService, KnowledgeSource } from '@agent/knowledge';

import { createRuntimeKnowledgeSearchBridge } from '../../../src/runtime/core/runtime-knowledge-search-factory';

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

function retrievalHit(chunk: KnowledgeChunk, score: number) {
  return {
    chunkId: chunk.id,
    documentId: chunk.documentId,
    sourceId: source.id,
    uri: source.uri,
    title: source.title,
    sourceType: source.sourceType,
    trustClass: source.trustClass,
    content: chunk.content,
    score,
    citation: {
      sourceId: source.id,
      chunkId: chunk.id,
      title: source.title,
      uri: source.uri
    }
  };
}

describe('runtime knowledge search bridge', () => {
  it('keeps the latest retrieval diagnostics on the runtime knowledge search bridge', async () => {
    const knowledgeSearchService: KnowledgeSearchService = {
      search: vi.fn(async () => ({
        hits: [retrievalHit(keywordChunk, 0.81)],
        total: 3,
        diagnostics: {
          retrievalMode: 'hybrid',
          candidateCount: 7,
          failedRetrievers: ['vector']
        }
      }))
    };
    const bridge = createRuntimeKnowledgeSearchBridge(knowledgeSearchService);

    expect(bridge.getLastDiagnostics?.()).toBeUndefined();

    const hits = await bridge.search('HX-9000 semantic alias', 4);

    expect(hits).toEqual([
      expect.objectContaining({
        chunkId: keywordChunk.id,
        content: keywordChunk.content
      })
    ]);
    expect(bridge.getLastDiagnostics?.()).toEqual(
      expect.objectContaining({
        query: 'HX-9000 semantic alias',
        limit: 4,
        hitCount: 1,
        total: 3,
        diagnostics: expect.objectContaining({
          retrievalMode: 'hybrid',
          candidateCount: 7,
          failedRetrievers: ['vector']
        }),
        searchedAt: expect.any(String)
      })
    );
  });

  it('adds post-retrieval diagnostics to the runtime knowledge search bridge snapshot', async () => {
    const knowledgeSearchService: KnowledgeSearchService = {
      search: vi.fn(async () => ({
        hits: [retrievalHit(keywordChunk, 0.81), retrievalHit(vectorChunk, 0.72)],
        total: 6,
        diagnostics: {
          retrievalMode: 'keyword-only',
          candidateCount: 2,
          failedRetrievers: [],
          providerError: new Error('vendor-specific failure')
        }
      }))
    };
    const bridge = createRuntimeKnowledgeSearchBridge(knowledgeSearchService);

    const hits = await bridge.search('HX-9000 semantic alias', 4);

    expect(hits).toHaveLength(2);
    expect(hits.map(hit => hit.chunkId)).toEqual(expect.arrayContaining([keywordChunk.id, vectorChunk.id]));
    expect(bridge.getLastDiagnostics?.()).toEqual(
      expect.objectContaining({
        query: 'HX-9000 semantic alias',
        limit: 4,
        hitCount: 2,
        total: 6,
        diagnostics: expect.objectContaining({
          retrievalMode: 'keyword-only',
          candidateCount: 2,
          failedRetrievers: [],
          postRetrieval: expect.objectContaining({
            filtering: expect.any(Object),
            ranking: expect.any(Object),
            diversification: expect.any(Object)
          })
        })
      })
    );
    expect(JSON.stringify(bridge.getLastDiagnostics?.().diagnostics)).not.toContain('vendor-specific failure');
    expect(bridge.getLastDiagnostics?.().diagnostics).not.toHaveProperty('providerError');
  });
});
