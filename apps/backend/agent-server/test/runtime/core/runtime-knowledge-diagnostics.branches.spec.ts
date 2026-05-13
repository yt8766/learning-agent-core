import { describe, expect, it } from 'vitest';

import { normalizeRuntimeKnowledgeDiagnostics } from '../../../src/runtime/core/runtime-knowledge-diagnostics';

describe('normalizeRuntimeKnowledgeDiagnostics', () => {
  it('returns undefined for non-object input', () => {
    expect(normalizeRuntimeKnowledgeDiagnostics(null)).toBeUndefined();
    expect(normalizeRuntimeKnowledgeDiagnostics(undefined)).toBeUndefined();
    expect(normalizeRuntimeKnowledgeDiagnostics('string')).toBeUndefined();
    expect(normalizeRuntimeKnowledgeDiagnostics(42)).toBeUndefined();
    expect(normalizeRuntimeKnowledgeDiagnostics([1, 2])).toBeUndefined();
  });

  it('returns undefined for empty object', () => {
    expect(normalizeRuntimeKnowledgeDiagnostics({})).toBeUndefined();
  });

  it('copies hybrid diagnostics fields', () => {
    const result = normalizeRuntimeKnowledgeDiagnostics({
      retrievalMode: 'hybrid',
      enabledRetrievers: ['vector', 'keyword'],
      failedRetrievers: ['keyword'],
      fusionStrategy: 'rrf',
      prefilterApplied: true,
      candidateCount: 42
    });
    expect(result).toBeDefined();
    expect(result!.retrievalMode).toBe('hybrid');
    expect(result!.enabledRetrievers).toEqual(['vector', 'keyword']);
    expect(result!.failedRetrievers).toEqual(['keyword']);
    expect(result!.fusionStrategy).toBe('rrf');
    expect(result!.prefilterApplied).toBe(true);
    expect(result!.candidateCount).toBe(42);
  });

  it('skips non-string retrievalMode', () => {
    const result = normalizeRuntimeKnowledgeDiagnostics({
      retrievalMode: 123
    });
    expect(result).toBeUndefined();
  });

  it('skips non-array enabledRetrievers', () => {
    const result = normalizeRuntimeKnowledgeDiagnostics({
      enabledRetrievers: 'not-array'
    });
    expect(result).toBeUndefined();
  });

  it('skips mixed-type array for enabledRetrievers', () => {
    const result = normalizeRuntimeKnowledgeDiagnostics({
      enabledRetrievers: ['valid', 123]
    });
    expect(result).toBeUndefined();
  });

  it('skips non-boolean prefilterApplied', () => {
    const result = normalizeRuntimeKnowledgeDiagnostics({
      prefilterApplied: 'yes'
    });
    expect(result).toBeUndefined();
  });

  it('skips non-finite candidateCount', () => {
    const result = normalizeRuntimeKnowledgeDiagnostics({
      candidateCount: Infinity
    });
    expect(result).toBeUndefined();
  });

  it('normalizes nested hybrid diagnostics', () => {
    const result = normalizeRuntimeKnowledgeDiagnostics({
      retrievalMode: 'hybrid',
      hybrid: {
        retrievalMode: 'keyword-only',
        enabledRetrievers: ['keyword'],
        candidateCount: 10
      }
    });
    expect(result!.hybrid).toEqual({
      retrievalMode: 'keyword-only',
      enabledRetrievers: ['keyword'],
      candidateCount: 10
    });
  });

  it('skips empty nested hybrid', () => {
    const result = normalizeRuntimeKnowledgeDiagnostics({
      retrievalMode: 'hybrid',
      hybrid: {}
    });
    expect(result!.hybrid).toBeUndefined();
  });

  it('skips non-object nested hybrid', () => {
    const result = normalizeRuntimeKnowledgeDiagnostics({
      retrievalMode: 'hybrid',
      hybrid: 'invalid'
    });
    expect(result!.hybrid).toBeUndefined();
  });

  it('normalizes postRetrieval with all subsections', () => {
    const result = normalizeRuntimeKnowledgeDiagnostics({
      postRetrieval: {
        filtering: {
          enabled: true,
          beforeCount: 100,
          afterCount: 50,
          droppedCount: 40,
          maskedCount: 10,
          reasons: { lowScore: 30, duplicate: 10 }
        },
        ranking: {
          enabled: true,
          strategy: 'bm25',
          scoredCount: 50,
          signals: ['relevance', 'freshness']
        },
        diversification: {
          enabled: false,
          strategy: 'mmr',
          beforeCount: 50,
          afterCount: 30,
          maxPerSource: 5,
          maxPerParent: 10
        }
      }
    });
    expect(result!.postRetrieval).toBeDefined();
    expect((result!.postRetrieval as any).filtering.beforeCount).toBe(100);
    expect((result!.postRetrieval as any).filtering.reasons).toEqual({ lowScore: 30, duplicate: 10 });
    expect((result!.postRetrieval as any).ranking.strategy).toBe('bm25');
    expect((result!.postRetrieval as any).diversification.maxPerSource).toBe(5);
  });

  it('returns undefined for postRetrieval with missing filtering', () => {
    const result = normalizeRuntimeKnowledgeDiagnostics({
      retrievalMode: 'hybrid',
      postRetrieval: {
        ranking: { strategy: 'bm25', signals: ['s1'] },
        diversification: { beforeCount: 10, afterCount: 5, maxPerSource: 2 }
      }
    });
    expect(result).toBeDefined();
    expect(result!.postRetrieval).toBeUndefined();
  });

  it('returns undefined for postRetrieval with missing ranking', () => {
    const result = normalizeRuntimeKnowledgeDiagnostics({
      retrievalMode: 'hybrid',
      postRetrieval: {
        filtering: { beforeCount: 10, afterCount: 5, droppedCount: 5 },
        diversification: { beforeCount: 10, afterCount: 5, maxPerSource: 2 }
      }
    });
    expect(result).toBeDefined();
    expect(result!.postRetrieval).toBeUndefined();
  });

  it('returns undefined for filtering without required numbers', () => {
    const result = normalizeRuntimeKnowledgeDiagnostics({
      retrievalMode: 'hybrid',
      postRetrieval: {
        filtering: { enabled: true },
        ranking: { strategy: 'bm25', signals: ['s1'] },
        diversification: { beforeCount: 10, afterCount: 5, maxPerSource: 2 }
      }
    });
    expect(result).toBeDefined();
    expect(result!.postRetrieval).toBeUndefined();
  });

  it('returns undefined for ranking without strategy string', () => {
    const result = normalizeRuntimeKnowledgeDiagnostics({
      retrievalMode: 'hybrid',
      postRetrieval: {
        filtering: { beforeCount: 10, afterCount: 5, droppedCount: 5 },
        ranking: { signals: ['s1'] },
        diversification: { beforeCount: 10, afterCount: 5, maxPerSource: 2 }
      }
    });
    expect(result).toBeDefined();
    expect(result!.postRetrieval).toBeUndefined();
  });

  it('returns undefined for ranking without signals array', () => {
    const result = normalizeRuntimeKnowledgeDiagnostics({
      retrievalMode: 'hybrid',
      postRetrieval: {
        filtering: { beforeCount: 10, afterCount: 5, droppedCount: 5 },
        ranking: { strategy: 'bm25' },
        diversification: { beforeCount: 10, afterCount: 5, maxPerSource: 2 }
      }
    });
    expect(result).toBeDefined();
    expect(result!.postRetrieval).toBeUndefined();
  });

  it('returns undefined for diversification without required numbers', () => {
    const result = normalizeRuntimeKnowledgeDiagnostics({
      retrievalMode: 'hybrid',
      postRetrieval: {
        filtering: { beforeCount: 10, afterCount: 5, droppedCount: 5 },
        ranking: { strategy: 'bm25', signals: ['s1'] },
        diversification: { enabled: true }
      }
    });
    expect(result).toBeDefined();
    expect(result!.postRetrieval).toBeUndefined();
  });

  it('skips non-object filtering reasons', () => {
    const result = normalizeRuntimeKnowledgeDiagnostics({
      postRetrieval: {
        filtering: {
          beforeCount: 10,
          afterCount: 5,
          droppedCount: 5,
          reasons: 'invalid'
        },
        ranking: { strategy: 'bm25', signals: ['s1'] },
        diversification: { beforeCount: 10, afterCount: 5, maxPerSource: 2 }
      }
    });
    expect((result!.postRetrieval as any).filtering.reasons).toBeUndefined();
  });

  it('skips non-finite values in filtering reasons', () => {
    const result = normalizeRuntimeKnowledgeDiagnostics({
      postRetrieval: {
        filtering: {
          beforeCount: 10,
          afterCount: 5,
          droppedCount: 5,
          reasons: { good: 5, bad: Infinity }
        },
        ranking: { strategy: 'bm25', signals: ['s1'] },
        diversification: { beforeCount: 10, afterCount: 5, maxPerSource: 2 }
      }
    });
    expect((result!.postRetrieval as any).filtering.reasons).toEqual({ good: 5 });
  });

  it('skips non-object postRetrieval', () => {
    const result = normalizeRuntimeKnowledgeDiagnostics({
      retrievalMode: 'hybrid',
      postRetrieval: 'invalid'
    });
    expect(result!.postRetrieval).toBeUndefined();
  });
});
