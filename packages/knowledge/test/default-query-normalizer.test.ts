import { describe, expect, it } from 'vitest';

import type { RetrievalRequest } from '@agent/core';

import {
  DEFAULT_QUERY_VARIANT_LIMIT,
  DEFAULT_RETRIEVAL_LIMIT
} from '../src/runtime/defaults/retrieval-runtime-defaults';
import { DefaultQueryNormalizer } from '../src/runtime/defaults/default-query-normalizer';

describe('DefaultQueryNormalizer', () => {
  it('preserves passthrough behavior for already-normalized queries', async () => {
    const normalizer = new DefaultQueryNormalizer();
    const request: RetrievalRequest = { query: '  retrieval pipeline  ' };

    const normalized = await normalizer.normalize(request);

    expect(normalized.originalQuery).toBe(request.query);
    expect(normalized.normalizedQuery).toBe('retrieval pipeline');
    expect(normalized.topK).toBe(DEFAULT_RETRIEVAL_LIMIT);
    expect(normalized.rewriteApplied).toBe(false);
    expect(normalized.rewriteReason).toBeUndefined();
    expect(normalized.queryVariants).toEqual(['retrieval pipeline']);
  });

  it('rewrites colloquial phrasing into a bounded, deduped query variant set', async () => {
    const normalizer = new DefaultQueryNormalizer();

    const normalized = await normalizer.normalize({
      query: '  咋把知识检索搞得更准一点  ',
      limit: 8
    });
    const originalQuery = normalized.originalQuery ?? '';
    const queryVariants = normalized.queryVariants ?? [];

    expect(normalized.originalQuery).toBe('  咋把知识检索搞得更准一点  ');
    expect(normalized.normalizedQuery).toEqual(expect.any(String));
    expect(normalized.topK).toBe(8);
    expect(normalized.rewriteApplied).toBe(true);
    expect(normalized.rewriteReason).toEqual(expect.any(String));
    expect(queryVariants.length).toBeGreaterThan(1);
    expect(queryVariants.length).toBeLessThanOrEqual(DEFAULT_QUERY_VARIANT_LIMIT);
    expect(new Set(queryVariants).size).toBe(queryVariants.length);
    expect(queryVariants).toContain(normalized.normalizedQuery);
    expect(queryVariants.some(variant => variant !== originalQuery.trim())).toBe(true);
    expect(queryVariants.every(variant => variant.trim() === variant)).toBe(true);
  });
});
