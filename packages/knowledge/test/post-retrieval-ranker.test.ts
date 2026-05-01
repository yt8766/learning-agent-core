import { describe, expect, it } from 'vitest';

import type { RetrievalHit } from '../src/contracts/types/knowledge-retrieval.types';
import { DefaultPostRetrievalRanker } from '../src/runtime/defaults/default-post-retrieval-ranker';
import type { RetrievalRerankProvider } from '../src/runtime/stages/post-retrieval-ranker';

function makeHit(overrides: Partial<RetrievalHit> = {}): RetrievalHit {
  return {
    chunkId: 'chunk-1',
    documentId: 'doc-1',
    sourceId: 'source-1',
    title: 'Guide',
    uri: '/guide.md',
    sourceType: 'repo-docs',
    trustClass: 'curated',
    content: '病假超过 3 天需要提供医院诊断证明。',
    score: 0.6,
    citation: {
      sourceId: 'source-1',
      chunkId: 'chunk-1',
      title: 'Guide',
      uri: '/guide.md',
      sourceType: 'repo-docs',
      trustClass: 'curated'
    },
    ...overrides
  };
}

const request = {
  query: '2026 年病假超过 3 天需要什么材料',
  normalizedQuery: '2026 年病假超过 3 天需要什么材料',
  topK: 5
};

describe('DefaultPostRetrievalRanker', () => {
  it('prioritizes direct answer value over weak topical recency', async () => {
    const ranker = new DefaultPostRetrievalRanker(new Date('2026-05-01T00:00:00.000Z'));

    const result = await ranker.rank(
      [
        makeHit({
          chunkId: 'new-but-weak',
          content: '2026 年病假工资按照公司考勤制度计算。',
          score: 0.62,
          metadata: { updatedAt: '2026-04-20T00:00:00.000Z' }
        }),
        makeHit({
          chunkId: 'direct-answer',
          content: '病假超过 3 天需要提供医院诊断证明材料。',
          score: 0.6,
          metadata: { updatedAt: '2025-12-01T00:00:00.000Z' }
        })
      ],
      request
    );

    expect(result.hits.map(hit => hit.chunkId)).toEqual(['direct-answer', 'new-but-weak']);
    expect(result.diagnostics.signals).toEqual([
      'retrieval-score',
      'authority',
      'recency',
      'context-fit',
      'exact-constraint'
    ]);
  });

  it('uses authority and recency as tie breakers for similarly useful hits', async () => {
    const ranker = new DefaultPostRetrievalRanker(new Date('2026-05-01T00:00:00.000Z'));

    const result = await ranker.rank(
      [
        makeHit({
          chunkId: 'community-old',
          trustClass: 'community',
          content: '病假超过 3 天需要提供医院诊断证明材料。',
          score: 0.7,
          metadata: { updatedAt: '2024-01-01T00:00:00.000Z' }
        }),
        makeHit({
          chunkId: 'official-new',
          trustClass: 'official',
          content: '病假超过 3 天需要提供医院诊断证明材料。',
          score: 0.7,
          metadata: { updatedAt: '2026-04-01T00:00:00.000Z' }
        })
      ],
      request
    );

    expect(result.hits.map(hit => hit.chunkId)).toEqual(['official-new', 'community-old']);
  });

  it('uses injected reranker alignment scores as a semantic ranking signal', async () => {
    const provider: RetrievalRerankProvider = {
      rerank: async ({ query, hits }) => {
        expect(query).toBe(request.normalizedQuery);
        expect(hits.map(hit => hit.chunkId)).toEqual(['deterministic-first', 'semantic-first']);
        return [
          { chunkId: 'semantic-first', alignmentScore: 0.95 },
          { chunkId: 'deterministic-first', alignmentScore: 0.1 }
        ];
      }
    };
    const ranker = new DefaultPostRetrievalRanker({
      now: new Date('2026-05-01T00:00:00.000Z'),
      rerankProvider: provider
    });

    const result = await ranker.rank(
      [
        makeHit({
          chunkId: 'deterministic-first',
          trustClass: 'official',
          content: '病假超过 3 天需要提供医院诊断证明材料。',
          score: 0.9,
          metadata: { updatedAt: '2026-04-20T00:00:00.000Z' }
        }),
        makeHit({
          chunkId: 'semantic-first',
          trustClass: 'community',
          content: '员工请病假超过三天时，需要提交医疗机构诊断证明和请假材料。',
          score: 0.45,
          metadata: { updatedAt: '2024-01-01T00:00:00.000Z' }
        })
      ],
      request
    );

    expect(result.hits.map(hit => hit.chunkId)).toEqual(['semantic-first', 'deterministic-first']);
    expect(result.diagnostics.strategy).toBe('deterministic-signals+semantic-rerank');
    expect(result.diagnostics.signals).toContain('semantic-rerank');
    expect(result.diagnostics.signals).toContain('alignment');
  });

  it('falls back to deterministic signals when injected reranker fails', async () => {
    const provider: RetrievalRerankProvider = {
      rerank: async () => {
        throw new Error('provider unavailable');
      }
    };
    const ranker = new DefaultPostRetrievalRanker({
      now: new Date('2026-05-01T00:00:00.000Z'),
      rerankProvider: provider
    });

    const result = await ranker.rank(
      [
        makeHit({
          chunkId: 'new-but-weak',
          content: '2026 年病假工资按照公司考勤制度计算。',
          score: 0.62,
          metadata: { updatedAt: '2026-04-20T00:00:00.000Z' }
        }),
        makeHit({
          chunkId: 'direct-answer',
          content: '病假超过 3 天需要提供医院诊断证明材料。',
          score: 0.6,
          metadata: { updatedAt: '2025-12-01T00:00:00.000Z' }
        })
      ],
      request
    );

    expect(result.hits.map(hit => hit.chunkId)).toEqual(['direct-answer', 'new-but-weak']);
    expect(result.diagnostics.strategy).toBe('deterministic-signals');
    expect(result.diagnostics.signals).toEqual([
      'retrieval-score',
      'authority',
      'recency',
      'context-fit',
      'exact-constraint'
    ]);
  });
});
