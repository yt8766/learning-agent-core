import type { RetrievalHit, RetrievalRequest } from '@agent/core';

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

function dedupeQueries(queries: string[]): string[] {
  const deduped: string[] = [];
  const seen = new Set<string>();

  for (const query of queries) {
    const normalizedQuery = query.trim();
    if (!normalizedQuery) {
      continue;
    }

    const fingerprint = normalizedQuery.toLowerCase();
    if (seen.has(fingerprint)) {
      continue;
    }

    seen.add(fingerprint);
    deduped.push(normalizedQuery);
  }

  return deduped;
}

type SearchHits = Awaited<ReturnType<KnowledgeSearchService['search']>>['hits'];

function mergeHitsByChunkId(hitGroups: SearchHits[]): RetrievalHit[] {
  const hitsByChunkId = new Map<string, RetrievalHit>();

  for (const hits of hitGroups) {
    for (const hit of hits) {
      const existingHit = hitsByChunkId.get(hit.chunkId);
      if (!existingHit || hit.score > existingHit.score) {
        hitsByChunkId.set(hit.chunkId, hit);
      }
    }
  }

  return Array.from(hitsByChunkId.values()).sort((left, right) => right.score - left.score);
}

export async function runKnowledgeRetrieval(options: KnowledgeRetrievalRunOptions): Promise<KnowledgeRetrievalResult> {
  const { request, searchService, pipeline = {}, assembleContext = false, includeDiagnostics = false } = options;

  const queryNormalizer = pipeline.queryNormalizer ?? new DefaultQueryNormalizer();
  const postProcessor = pipeline.postProcessor ?? new DefaultRetrievalPostProcessor();
  const contextAssembler = assembleContext ? (pipeline.contextAssembler ?? new DefaultContextAssembler()) : null;

  const startedAt = new Date().toISOString();
  const startMs = Date.now();

  const normalized = await queryNormalizer.normalize(request);
  const queryVariants = dedupeQueries(
    normalized.queryVariants?.length ? normalized.queryVariants : [normalized.normalizedQuery]
  );
  const effectiveNormalized = {
    ...normalized,
    originalQuery: normalized.originalQuery ?? request.query,
    normalizedQuery: normalized.normalizedQuery,
    topK: normalized.topK,
    rewriteApplied: normalized.rewriteApplied ?? false,
    rewriteReason: normalized.rewriteReason,
    queryVariants
  };
  const executedQueries: string[] = [];
  const searchResults: SearchHits[] = [];

  for (const query of queryVariants) {
    executedQueries.push(query);
    const result = await searchService.search({
      ...request,
      query,
      limit: normalized.topK
    });
    searchResults.push(result.hits);
  }

  const mergedHits = mergeHitsByChunkId(searchResults);
  const preHitCount = mergedHits.length;
  const processedHits = await postProcessor.process(mergedHits, effectiveNormalized);
  const postHitCount = processedHits.length;

  const contextBundle = contextAssembler
    ? await contextAssembler.assemble(processedHits, effectiveNormalized)
    : undefined;

  return {
    hits: processedHits,
    total: postHitCount,
    contextBundle,
    diagnostics: includeDiagnostics
      ? {
          runId: `knowledge-retrieval-${Date.now()}`,
          startedAt,
          durationMs: Date.now() - startMs,
          originalQuery: effectiveNormalized.originalQuery,
          normalizedQuery: effectiveNormalized.normalizedQuery,
          rewriteApplied: effectiveNormalized.rewriteApplied,
          rewriteReason: effectiveNormalized.rewriteReason,
          queryVariants,
          executedQueries,
          preHitCount,
          postHitCount,
          contextAssembled: Boolean(contextBundle)
        }
      : undefined
  };
}
