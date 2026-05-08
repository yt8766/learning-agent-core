import type { RetrievalHit, RetrievalRequest } from '../../index';

import type { KnowledgeSearchService } from '../../contracts/knowledge-facade';
import type { RetrievalPipelineConfig } from '../../contracts/knowledge-retrieval-runtime';
import {
  matchesKnowledgeHitFilters,
  resolveKnowledgeRetrievalFilters
} from '../../retrieval/knowledge-retrieval-filters';
import type { ContextExpansionDiagnostics } from '../stages/context-expander';
import type { QueryNormalizer } from '../stages/query-normalizer';
import type {
  HybridRetrievalDiagnostics,
  KnowledgeRetrievalResult,
  RetrievalDiagnostics,
  RetrievalFilteringStageDiagnostics
} from '../types/retrieval-runtime.types';
import { DefaultContextAssembler } from '../defaults/default-context-assembler';
import { DefaultPostRetrievalDiversifier } from '../defaults/default-post-retrieval-diversifier';
import { DefaultPostRetrievalFilter } from '../defaults/default-post-retrieval-filter';
import { DefaultPostRetrievalRanker } from '../defaults/default-post-retrieval-ranker';
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

interface SearchResultDiagnostics {
  diagnostics?: HybridRetrievalDiagnostics;
}

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

function mergeHybridDiagnostics(diagnostics: HybridRetrievalDiagnostics[]): HybridRetrievalDiagnostics | undefined {
  if (diagnostics.length === 0) {
    return undefined;
  }

  const enabledRetrievers = new Set<HybridRetrievalDiagnostics['enabledRetrievers'][number]>();
  const failedRetrievers = new Set<HybridRetrievalDiagnostics['failedRetrievers'][number]>();
  let candidateCount = 0;
  let hasKeywordSuccess = false;
  let hasVectorSuccess = false;

  for (const item of diagnostics) {
    const itemFailedRetrievers = item.failedRetrievers ?? [];
    const itemEnabledRetrievers =
      item.enabledRetrievers ??
      (item.retrievalMode === 'hybrid'
        ? ['keyword', 'vector']
        : item.retrievalMode === 'keyword-only'
          ? ['keyword']
          : item.retrievalMode === 'vector-only'
            ? ['vector']
            : []);

    itemEnabledRetrievers.forEach(retriever => enabledRetrievers.add(retriever));
    itemFailedRetrievers.forEach(retriever => failedRetrievers.add(retriever));
    candidateCount += item.candidateCount ?? 0;
    hasKeywordSuccess ||= itemEnabledRetrievers.includes('keyword') && !itemFailedRetrievers.includes('keyword');
    hasVectorSuccess ||= itemEnabledRetrievers.includes('vector') && !itemFailedRetrievers.includes('vector');
  }

  const retrievalMode =
    hasKeywordSuccess && hasVectorSuccess
      ? 'hybrid'
      : hasKeywordSuccess
        ? 'keyword-only'
        : hasVectorSuccess
          ? 'vector-only'
          : 'none';

  return {
    retrievalMode,
    enabledRetrievers: Array.from(enabledRetrievers),
    failedRetrievers: Array.from(failedRetrievers),
    fusionStrategy: diagnostics.find(item => item.fusionStrategy)?.fusionStrategy ?? 'rrf',
    prefilterApplied: diagnostics.some(item => item.prefilterApplied ?? false),
    candidateCount
  };
}

export async function runKnowledgeRetrieval(options: KnowledgeRetrievalRunOptions): Promise<KnowledgeRetrievalResult> {
  const { request, searchService, pipeline = {}, assembleContext = false, includeDiagnostics = false } = options;

  const queryNormalizer = resolveNormalizerChain(pipeline.queryNormalizer);
  const postRetrievalFilter =
    pipeline.postRetrievalFilter ?? new DefaultPostRetrievalFilter({ safetyScanner: pipeline.safetyScanner });
  const postRetrievalRanker =
    pipeline.postRetrievalRanker ?? new DefaultPostRetrievalRanker({ rerankProvider: pipeline.rerankProvider });
  const postRetrievalDiversifier = pipeline.postRetrievalDiversifier ?? new DefaultPostRetrievalDiversifier();
  const postProcessor = pipeline.postProcessor ?? new DefaultRetrievalPostProcessor();
  const contextAssembler = assembleContext ? (pipeline.contextAssembler ?? new DefaultContextAssembler()) : null;

  const startedAt = new Date().toISOString();
  const startMs = Date.now();

  const normalized = await queryNormalizer.normalize(request);
  const resolvedFilters = resolveKnowledgeRetrievalFilters(request);
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
  const filteringStages: RetrievalFilteringStageDiagnostics[] = [];
  const hybridDiagnostics: HybridRetrievalDiagnostics[] = [];

  for (const query of queryVariants) {
    executedQueries.push(query);
    const result = await searchService.search({
      ...request,
      query,
      limit: normalized.topK
    });
    const searchDiagnostics = (result as SearchResultDiagnostics).diagnostics;
    if (searchDiagnostics) {
      hybridDiagnostics.push(searchDiagnostics);
    }
    const beforeCount = result.hits.length;
    const filteredHits = result.hits.filter(hit => matchesKnowledgeHitFilters(hit, resolvedFilters));
    const afterCount = filteredHits.length;
    filteringStages.push({
      stage: 'pre-merge-defensive',
      beforeCount,
      afterCount,
      droppedCount: beforeCount - afterCount
    });
    searchResults.push(filteredHits);
  }

  const mergedHits = mergeHitsByChunkId(searchResults);
  const preHitCount = mergedHits.length;
  const filterResult = await postRetrievalFilter.filter(mergedHits, effectiveNormalized);
  const rankResult = await postRetrievalRanker.rank(filterResult.hits, effectiveNormalized);
  const diversifyResult = await postRetrievalDiversifier.diversify(rankResult.hits, effectiveNormalized);
  const processedHits = await postProcessor.process(diversifyResult.hits, effectiveNormalized);
  const postHitCount = processedHits.length;
  let contextHits = processedHits;
  let contextExpansionDiagnostics: ContextExpansionDiagnostics | undefined;

  if (contextAssembler && pipeline.contextExpander) {
    const expanded = await pipeline.contextExpander.expand(processedHits, effectiveNormalized, {
      filters: resolvedFilters,
      policy: pipeline.contextExpansionPolicy
    });
    contextHits = expanded.hits;
    contextExpansionDiagnostics = expanded.diagnostics;
  }

  const contextAssemblyOutput = contextAssembler
    ? pipeline.contextAssemblyOptions
      ? await contextAssembler.assemble(contextHits, effectiveNormalized, pipeline.contextAssemblyOptions)
      : await contextAssembler.assemble(contextHits, effectiveNormalized)
    : undefined;
  const contextBundle =
    typeof contextAssemblyOutput === 'string' ? contextAssemblyOutput : contextAssemblyOutput?.contextBundle;
  const contextAssemblyDiagnostics =
    typeof contextAssemblyOutput === 'string' ? undefined : contextAssemblyOutput?.diagnostics;

  const diagnostics: RetrievalDiagnostics | undefined = includeDiagnostics
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
        contextAssembled: Boolean(contextBundle),
        contextAssembly: contextAssemblyDiagnostics,
        contextExpansion: contextExpansionDiagnostics,
        postRetrieval: {
          filtering: filterResult.diagnostics,
          ranking: rankResult.diagnostics,
          diversification: diversifyResult.diagnostics
        },
        filtering: {
          enabled: Boolean(request.filters || request.allowedSourceTypes || request.minTrustClass),
          stages: filteringStages
        },
        hybrid: mergeHybridDiagnostics(hybridDiagnostics)
      }
    : undefined;

  return {
    hits: processedHits,
    total: postHitCount,
    contextBundle,
    diagnostics
  };
}
