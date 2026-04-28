import type { RetrievalHit, RetrievalRequest } from '@agent/knowledge';

import type { KnowledgeSearchService } from '../../contracts/knowledge-facade';
import type { RetrievalPipelineConfig } from '../../contracts/knowledge-retrieval-runtime';
import type { QueryNormalizer } from '../stages/query-normalizer';
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

function resolveNormalizerChain(config: QueryNormalizer | QueryNormalizer[] | undefined): QueryNormalizer {
  if (!config) return new DefaultQueryNormalizer();
  if (!Array.isArray(config)) return config;
  const valid = config.filter((n): n is QueryNormalizer => n != null);
  if (valid.length === 0) return new DefaultQueryNormalizer();
  if (valid.length === 1) return valid[0]!;
  return {
    normalize: async request => {
      let result = await valid[0]!.normalize(request);
      for (const normalizer of valid.slice(1)) {
        result = await normalizer.normalize(result);
      }
      return result;
    }
  };
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

  const queryNormalizer = resolveNormalizerChain(pipeline.queryNormalizer);
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
