import { describe, expect, it, vi } from 'vitest';

import type { RetrievalRequest } from '@agent/knowledge';

import type { QueryRewriteProvider } from '../src/runtime/stages/query-rewrite-provider';
import type { NormalizedRetrievalRequest } from '../src/runtime/types/retrieval-runtime.types';
import { LlmQueryNormalizer } from '../src/runtime/defaults/llm-query-normalizer';

function makeRewriteProvider(rewrittenQuery: string): QueryRewriteProvider {
  return { rewrite: vi.fn(async () => rewrittenQuery) };
}

function makeFailingProvider(): QueryRewriteProvider {
  return {
    rewrite: vi.fn(async () => {
      throw new Error('LLM unavailable');
    })
  };
}

describe('LlmQueryNormalizer', () => {
  it('calls rewrite provider with the rule-normalized query', async () => {
    const provider = makeRewriteProvider('iPhone 15 的电池续航表现如何？');
    const normalizer = new LlmQueryNormalizer(provider);

    await normalizer.normalize({ query: '苹果 15 续航咋样' });

    expect(provider.rewrite).toHaveBeenCalledOnce();
    // rewrite 收到的是规则清洗后的结果（口语词已归一化）
    expect(provider.rewrite).toHaveBeenCalledWith(expect.stringContaining('苹果'));
  });

  it('returns LLM-rewritten query with rewriteApplied: true when provider succeeds', async () => {
    const provider = makeRewriteProvider('iPhone 15 的电池续航表现如何？');
    const normalizer = new LlmQueryNormalizer(provider);

    const result = await normalizer.normalize({ query: '苹果 15 续航咋样' });

    expect(result.normalizedQuery).toBe('iPhone 15 的电池续航表现如何？');
    expect(result.rewriteApplied).toBe(true);
    expect(result.rewriteReason).toBe('llm-semantic-rewrite');
    // buildQueryVariants cleans trailing punctuation, so we check for the cleaned version
    expect(result.queryVariants).toContain('iPhone 15 的电池续航表现如何');
  });

  it('silently falls back to rule-based result when provider throws', async () => {
    const normalizer = new LlmQueryNormalizer(makeFailingProvider());

    const result = await normalizer.normalize({ query: '苹果 15 续航咋样' });

    // 规则式 fallback 结果
    expect(result.normalizedQuery).toBeTruthy();
    expect(result.rewriteReason).not.toBe('llm-semantic-rewrite');
  });

  it('skips internal fallback when input already has normalizedQuery (chain scenario)', async () => {
    const provider = makeRewriteProvider('已改写的语义查询');
    const normalizer = new LlmQueryNormalizer(provider);

    // 模拟已经过前置 normalizer 处理的 request
    const alreadyNormalized: NormalizedRetrievalRequest = {
      query: '原始 query',
      originalQuery: '原始 query',
      normalizedQuery: '规则已处理的 query',
      topK: 5,
      rewriteApplied: false,
      queryVariants: ['规则已处理的 query']
    };

    const result = await normalizer.normalize(alreadyNormalized);

    // rewrite 应收到已归一化的 query，而不是原始 query
    expect(provider.rewrite).toHaveBeenCalledWith('规则已处理的 query');
    expect(result.normalizedQuery).toBe('已改写的语义查询');
  });

  it('accepts custom fallback normalizer', async () => {
    const customFallback = {
      normalize: vi.fn(
        async (req: RetrievalRequest): Promise<NormalizedRetrievalRequest> => ({
          ...req,
          originalQuery: req.query,
          normalizedQuery: 'custom-fallback-result',
          topK: 5,
          rewriteApplied: false
        })
      )
    };
    const normalizer = new LlmQueryNormalizer(makeFailingProvider(), customFallback);

    const result = await normalizer.normalize({ query: 'test query' });

    expect(customFallback.normalize).toHaveBeenCalledOnce();
    expect(result.normalizedQuery).toBe('custom-fallback-result');
  });
});
