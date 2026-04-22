import type { RetrievalRequest } from '@agent/core';

import type { KnowledgeSearchService } from '../../contracts/knowledge-facade';
import type { RetrievalPipelineConfig } from '../../contracts/knowledge-retrieval-runtime';
import type { KnowledgeRetrievalResult } from '../types/retrieval-runtime.types';
import { DefaultContextAssembler } from '../defaults/default-context-assembler';
import { DefaultQueryNormalizer } from '../defaults/default-query-normalizer';
import { DefaultRetrievalPostProcessor } from '../defaults/default-post-processor';

export interface KnowledgeRetrievalRunOptions {
  request: RetrievalRequest;
  searchService: KnowledgeSearchService;
  pipeline?: RetrievalPipelineConfig;
  assembleContext?: boolean;
  includeDiagnostics?: boolean;
}

export async function runKnowledgeRetrieval(options: KnowledgeRetrievalRunOptions): Promise<KnowledgeRetrievalResult> {
  const { request, searchService, pipeline = {}, assembleContext = false, includeDiagnostics = false } = options;

  const queryNormalizer = pipeline.queryNormalizer ?? new DefaultQueryNormalizer();
  const postProcessor = pipeline.postProcessor ?? new DefaultRetrievalPostProcessor();
  const contextAssembler = assembleContext ? (pipeline.contextAssembler ?? new DefaultContextAssembler()) : null;

  const startedAt = new Date().toISOString();
  const startMs = Date.now();

  const normalized = await queryNormalizer.normalize(request);

  const rawResult = await searchService.search({
    ...request,
    query: normalized.normalizedQuery,
    limit: normalized.topK
  });

  const preHitCount = rawResult.hits.length;
  const processedHits = await postProcessor.process(rawResult.hits, normalized);
  const postHitCount = processedHits.length;

  const contextBundle = contextAssembler ? await contextAssembler.assemble(processedHits, normalized) : undefined;

  return {
    hits: processedHits,
    total: postHitCount,
    contextBundle,
    diagnostics: includeDiagnostics
      ? {
          runId: `knowledge-retrieval-${Date.now()}`,
          startedAt,
          durationMs: Date.now() - startMs,
          normalizedQuery: normalized.normalizedQuery,
          preHitCount,
          postHitCount,
          contextAssembled: Boolean(contextBundle)
        }
      : undefined
  };
}
