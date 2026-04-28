import { describe, expect, it } from 'vitest';

import type { RetrievalHit } from '@agent/knowledge';

import { rrfFusion } from '../src/retrieval/rrf-fusion';

function makeHit(chunkId: string, score: number): RetrievalHit {
  return {
    chunkId,
    documentId: `doc-${chunkId}`,
    sourceId: 'source-1',
    title: 'Test',
    uri: '/test.md',
    sourceType: 'repo-docs',
    trustClass: 'internal',
    content: `content for ${chunkId}`,
    score,
    citation: {
      sourceId: 'source-1',
      chunkId,
      title: 'Test',
      uri: '/test.md',
      sourceType: 'repo-docs',
      trustClass: 'internal'
    }
  };
}

describe('rrfFusion', () => {
  it('returns empty array when given empty input', () => {
    expect(rrfFusion([])).toEqual([]);
  });

  it('returns empty array when all rank lists are empty', () => {
    expect(rrfFusion([[], []])).toEqual([]);
  });

  it('returns single list unchanged in order (scores replaced by RRF)', () => {
    const hits = [makeHit('a', 0.9), makeHit('b', 0.5), makeHit('c', 0.1)];
    const result = rrfFusion([hits]);
    expect(result.map(h => h.chunkId)).toEqual(['a', 'b', 'c']);
  });

  it('assigns higher RRF score to chunk appearing in both lists', () => {
    // chunk-shared 出现在两路，chunk-only-keyword/chunk-only-vector 各出现一路
    const keywordHits = [makeHit('chunk-shared', 0.9), makeHit('chunk-only-keyword', 0.8)];
    const vectorHits = [makeHit('chunk-shared', 0.85), makeHit('chunk-only-vector', 0.7)];
    const result = rrfFusion([keywordHits, vectorHits]);
    const sharedScore = result.find(h => h.chunkId === 'chunk-shared')!.score;
    const keywordOnlyScore = result.find(h => h.chunkId === 'chunk-only-keyword')!.score;
    const vectorOnlyScore = result.find(h => h.chunkId === 'chunk-only-vector')!.score;
    // 两路命中的 RRF 分数必须高于任一单路命中
    expect(sharedScore).toBeGreaterThan(keywordOnlyScore);
    expect(sharedScore).toBeGreaterThan(vectorOnlyScore);
  });

  it('de-duplicates chunks appearing in multiple lists', () => {
    const list1 = [makeHit('dup', 0.9), makeHit('unique1', 0.5)];
    const list2 = [makeHit('dup', 0.8), makeHit('unique2', 0.4)];
    const result = rrfFusion([list1, list2]);
    const dupHits = result.filter(h => h.chunkId === 'dup');
    expect(dupHits).toHaveLength(1);
    expect(result).toHaveLength(3);
  });

  it('higher k value reduces score differences between ranks', () => {
    const hits = [makeHit('a', 0.9), makeHit('b', 0.5)];
    const resultLowK = rrfFusion([[...hits]], 1);
    const resultHighK = rrfFusion([[...hits]], 1000);
    const diffLowK = (resultLowK[0]?.score ?? 0) - (resultLowK[1]?.score ?? 0);
    const diffHighK = (resultHighK[0]?.score ?? 0) - (resultHighK[1]?.score ?? 0);
    expect(diffLowK).toBeGreaterThan(diffHighK);
  });

  it('preserves hit metadata (content, citation, etc.) from first occurrence', () => {
    const hit = makeHit('chunk-1', 0.9);
    const result = rrfFusion([[hit]]);
    expect(result[0]?.content).toBe(hit.content);
    expect(result[0]?.citation).toEqual(hit.citation);
    expect(result[0]?.chunkId).toBe('chunk-1');
  });

  it('uses default k=60', () => {
    // 验证默认 k 行为：rank=1 时 RRF score = 1/(60+1) ≈ 0.0164
    const hits = [makeHit('only', 0.9)];
    const result = rrfFusion([hits]);
    expect(result[0]?.score).toBeCloseTo(1 / 61, 5);
  });
});
