import { describe, expect, it } from 'vitest';

import type { RetrievalHit } from '../src/contracts/types/knowledge-retrieval.types';
import { DefaultPostRetrievalFilter } from '../src/runtime/defaults/default-post-retrieval-filter';
import type { RetrievalSafetyScanner } from '../src/runtime/stages/post-retrieval-filter';

function makeHit(overrides: Partial<RetrievalHit> = {}): RetrievalHit {
  return {
    chunkId: 'chunk-1',
    documentId: 'doc-1',
    sourceId: 'source-1',
    title: 'Guide',
    uri: '/guide.md',
    sourceType: 'repo-docs',
    trustClass: 'internal',
    content: '病假超过 3 天需要提供医院诊断证明。',
    score: 0.8,
    citation: {
      sourceId: 'source-1',
      chunkId: 'chunk-1',
      title: 'Guide',
      uri: '/guide.md',
      sourceType: 'repo-docs',
      trustClass: 'internal',
      quote: '病假超过 3 天需要提供医院诊断证明。'
    },
    ...overrides
  };
}

const request = {
  query: '病假超过 3 天需要什么材料',
  normalizedQuery: '病假超过 3 天需要什么材料',
  topK: 5
};

describe('DefaultPostRetrievalFilter', () => {
  it('drops low score hits and records the reason', async () => {
    const filter = new DefaultPostRetrievalFilter(0.1);

    const result = await filter.filter(
      [makeHit({ chunkId: 'strong', score: 0.8 }), makeHit({ chunkId: 'weak', score: 0 })],
      request
    );

    expect(result.hits.map(hit => hit.chunkId)).toEqual(['strong']);
    expect(result.diagnostics.reasons['low-score']).toBe(1);
    expect(result.diagnostics.droppedCount).toBe(1);
  });

  it('keeps the highest scoring duplicate chunk', async () => {
    const filter = new DefaultPostRetrievalFilter(0.1);

    const result = await filter.filter(
      [
        makeHit({ chunkId: 'same', content: 'older duplicate', score: 0.4 }),
        makeHit({ chunkId: 'same', content: 'better duplicate', score: 0.9 })
      ],
      request
    );

    expect(result.hits).toHaveLength(1);
    expect(result.hits[0]?.content).toBe('better duplicate');
    expect(result.diagnostics.reasons['duplicate-chunk']).toBe(1);
  });

  it('preserves same-parent hits so diversification can decide parent coverage', async () => {
    const filter = new DefaultPostRetrievalFilter(0.1);

    const result = await filter.filter(
      [
        makeHit({ chunkId: 'parent-low', score: 0.6, metadata: { parentId: 'parent-1' } }),
        makeHit({ chunkId: 'parent-high', score: 0.9, metadata: { parentId: 'parent-1' } })
      ],
      request
    );

    expect(result.hits.map(hit => hit.chunkId)).toEqual(['parent-high', 'parent-low']);
    expect(result.diagnostics.reasons['duplicate-parent']).toBeUndefined();
  });

  it('drops low context value and unsafe content without returning the dropped text', async () => {
    const filter = new DefaultPostRetrievalFilter(0.1);

    const result = await filter.filter(
      [
        makeHit({ chunkId: 'toc', content: '目录\n第一章 总则\n第二章 请假管理', score: 0.8 }),
        makeHit({ chunkId: 'secret', content: 'password: hunter2', score: 0.8 }),
        makeHit({ chunkId: 'fact', content: '病假超过 3 天需要提供医院诊断证明。', score: 0.8 })
      ],
      request
    );

    expect(result.hits.map(hit => hit.chunkId)).toEqual(['fact']);
    expect(result.diagnostics.reasons['low-context-value']).toBe(1);
    expect(result.diagnostics.reasons['unsafe-content']).toBe(1);
  });

  it('uses an injected safety scanner to mask hit content and citation quote without dropping the hit', async () => {
    const scanner: RetrievalSafetyScanner = {
      scan: async hit =>
        hit.chunkId === 'sensitive'
          ? {
              action: 'mask',
              maskedContent: 'token: [REDACTED]'
            }
          : { action: 'keep' }
    };
    const filter = new DefaultPostRetrievalFilter({ minScore: 0.1, safetyScanner: scanner });

    const result = await filter.filter(
      [
        makeHit({
          chunkId: 'sensitive',
          content: 'token: secret-value',
          citation: {
            sourceId: 'source-1',
            chunkId: 'sensitive',
            title: 'Guide',
            uri: '/guide.md',
            sourceType: 'repo-docs',
            trustClass: 'internal',
            quote: 'token: secret-value'
          },
          score: 0.8
        })
      ],
      request
    );

    expect(result.hits).toHaveLength(1);
    expect(result.hits[0]?.content).toBe('token: [REDACTED]');
    expect(result.hits[0]?.citation.quote).toBe('token: [REDACTED]');
    expect(result.diagnostics.maskedCount).toBe(1);
    expect(result.diagnostics.droppedCount).toBe(0);
    expect(JSON.stringify(result.diagnostics)).not.toContain('secret-value');
  });

  it('uses an injected safety scanner to drop unsafe hits without leaking dropped content in diagnostics', async () => {
    const scanner: RetrievalSafetyScanner = {
      scan: async hit => (hit.chunkId === 'secret' ? { action: 'drop', reason: 'credential' } : { action: 'keep' })
    };
    const filter = new DefaultPostRetrievalFilter({ minScore: 0.1, safetyScanner: scanner });

    const result = await filter.filter(
      [
        makeHit({ chunkId: 'secret', content: 'client secret is very-sensitive', score: 0.8 }),
        makeHit({ chunkId: 'fact', content: '病假超过 3 天需要提供医院诊断证明。', score: 0.8 })
      ],
      request
    );

    expect(result.hits.map(hit => hit.chunkId)).toEqual(['fact']);
    expect(result.diagnostics.reasons['unsafe-content']).toBe(1);
    expect(result.diagnostics.droppedCount).toBe(1);
    expect(JSON.stringify(result.diagnostics)).not.toContain('very-sensitive');
  });

  it('falls back to the built-in unsafe pattern when the safety scanner fails', async () => {
    const scanner: RetrievalSafetyScanner = {
      scan: async () => {
        throw new Error('scanner unavailable');
      }
    };
    const filter = new DefaultPostRetrievalFilter({ minScore: 0.1, safetyScanner: scanner });

    const result = await filter.filter(
      [
        makeHit({ chunkId: 'unsafe', content: 'password: scanner-fallback-secret', score: 0.8 }),
        makeHit({ chunkId: 'safe', content: '病假超过 3 天需要提供医院诊断证明。', score: 0.8 })
      ],
      request
    );

    expect(result.hits.map(hit => hit.chunkId)).toEqual(['safe']);
    expect(result.diagnostics.reasons['unsafe-content']).toBe(1);
    expect(JSON.stringify(result.diagnostics)).not.toContain('scanner-fallback-secret');
  });
});
