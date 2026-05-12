import type { KnowledgeRagMetric, RetrievalHit, RetrievalRequest } from '../../index';

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
import { buildPostRetrievalSelectionTrace } from '../defaults/post-retrieval-selection-trace';
import {
  buildKnowledgeRagEventId,
  buildKnowledgeRagTraceRetrievalDiagnostics,
  collectKnowledgeRagTraceCitations,
  mergeKnowledgeHybridDiagnostics,
  toKnowledgeRagTraceError,
  toKnowledgeRagTraceHits,
  tryFinishKnowledgeRagTrace,
  tryRecordKnowledgeRagEvent,
  tryStartKnowledgeRagTrace,
  type KnowledgeRagObserver
} from '../../observability';

export interface KnowledgeRetrievalRunOptions {
  request: RetrievalRequest;
  searchService: KnowledgeSearchService;
  pipeline?: RetrievalPipelineConfig;
  assembleContext?: boolean;
  includeDiagnostics?: boolean;
  observer?: KnowledgeRagObserver;
  traceId?: string;
  startTrace?: boolean;
}

/**
 * Normalizers compose sequentially: each stage receives the previous stage result.
 * This lets hosts add deterministic or LLM rewrites without changing the retrieval pipeline contract.
 */
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

/**
 * Merges multi-query retrieval candidates by chunk id.
 * When the same chunk appears in multiple query variants, keep the highest-scoring hit and sort globally by score.
 */
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
  const {
    request,
    searchService,
    pipeline = {},
    assembleContext = false,
    includeDiagnostics = false,
    observer,
    traceId = `knowledge-retrieval-${Date.now()}`,
    startTrace = true
  } = options;

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

  if (startTrace) {
    tryStartKnowledgeRagTrace(observer, {
      traceId,
      operation: 'retrieval.run',
      startedAt,
      query: { text: request.query }
    });
  }

  try {
    recordRetrievalEvent(observer, {
      eventId: makeTraceEventId(traceId, 'runtime.query.receive'),
      traceId,
      name: 'runtime.query.receive',
      stage: 'pre-retrieval',
      occurredAt: new Date().toISOString(),
      query: { text: request.query }
    });

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
    recordRetrievalEvent(observer, {
      eventId: makeTraceEventId(traceId, 'runtime.query.preprocess'),
      traceId,
      name: 'runtime.query.preprocess',
      stage: 'pre-retrieval',
      occurredAt: new Date().toISOString(),
      query: {
        text: effectiveNormalized.originalQuery,
        normalizedText: effectiveNormalized.normalizedQuery,
        variants: queryVariants
      }
    });
    const executedQueries: string[] = [];
    const searchResults: SearchHits[] = [];
    const filteringStages: RetrievalFilteringStageDiagnostics[] = [];
    const hybridDiagnostics: HybridRetrievalDiagnostics[] = [];
    const retrievalStartedAt = Date.now();

    recordRetrievalEvent(observer, {
      eventId: makeTraceEventId(traceId, 'runtime.retrieval.start'),
      traceId,
      name: 'runtime.retrieval.start',
      stage: 'retrieval',
      occurredAt: new Date().toISOString(),
      attributes: {
        requestedTopK: effectiveNormalized.topK
      }
    });

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
    const retrievalDiagnostics = buildKnowledgeRagTraceRetrievalDiagnostics({
      hybrid: mergeKnowledgeHybridDiagnostics(hybridDiagnostics),
      candidateCount: preHitCount,
      selectedCount: preHitCount,
      latencyMs: Date.now() - retrievalStartedAt
    });

    recordRetrievalEvent(observer, {
      eventId: makeTraceEventId(traceId, 'runtime.retrieval.complete'),
      traceId,
      name: 'runtime.retrieval.complete',
      stage: 'retrieval',
      occurredAt: new Date().toISOString(),
      retrieval: {
        requestedTopK: effectiveNormalized.topK,
        hits: toKnowledgeRagTraceHits(mergedHits),
        citations: collectKnowledgeRagTraceCitations(mergedHits),
        diagnostics: retrievalDiagnostics
      }
    });

    const filterResult = await postRetrievalFilter.filter(mergedHits, effectiveNormalized);
    const rankResult = await postRetrievalRanker.rank(filterResult.hits, effectiveNormalized);
    const diversifyResult = await postRetrievalDiversifier.diversify(rankResult.hits, effectiveNormalized);
    const processedHits = await postProcessor.process(diversifyResult.hits, effectiveNormalized);
    const selectionTrace = buildPostRetrievalSelectionTrace([
      {
        stage: 'filtering',
        inputHits: mergedHits,
        outputHits: filterResult.hits,
        droppedReason: 'low-score'
      },
      {
        stage: 'ranking',
        inputHits: filterResult.hits,
        outputHits: rankResult.hits
      },
      {
        stage: 'diversification',
        inputHits: rankResult.hits,
        outputHits: diversifyResult.hits,
        droppedReason: 'source-limit'
      },
      {
        stage: 'post-processor',
        inputHits: diversifyResult.hits,
        outputHits: processedHits,
        droppedReason: 'post-processor-min-score'
      }
    ]);
    const postHitCount = processedHits.length;
    const postRetrievalDiagnostics = {
      ...retrievalDiagnostics,
      selectedCount: postHitCount
    };

    recordRetrievalEvent(observer, {
      eventId: makeTraceEventId(traceId, 'runtime.post_retrieval.select'),
      traceId,
      name: 'runtime.post_retrieval.select',
      stage: 'post-retrieval',
      occurredAt: new Date().toISOString(),
      diagnostics: postRetrievalDiagnostics,
      attributes: {
        selectedCount: postHitCount
      }
    });
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
    if (contextAssembler) {
      recordRetrievalEvent(observer, {
        eventId: makeTraceEventId(traceId, 'runtime.context_assembly.complete'),
        traceId,
        name: 'runtime.context_assembly.complete',
        stage: 'context-assembly',
        occurredAt: new Date().toISOString(),
        attributes: {
          contextAssembled: Boolean(contextBundle),
          contextLength: contextBundle?.length ?? 0
        }
      });
    }

    const hybrid = mergeKnowledgeHybridDiagnostics(hybridDiagnostics);
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
            diversification: diversifyResult.diagnostics,
            selectionTrace
          },
          filtering: {
            enabled: Boolean(request.filters || request.allowedSourceTypes || request.minTrustClass),
            stages: filteringStages
          },
          hybrid
        }
      : undefined;

    const result = {
      hits: processedHits,
      total: postHitCount,
      contextBundle,
      diagnostics
    };

    if (startTrace) {
      tryFinishKnowledgeRagTrace(observer, traceId, {
        status: 'succeeded',
        endedAt: new Date().toISOString(),
        query: {
          text: effectiveNormalized.originalQuery,
          normalizedText: effectiveNormalized.normalizedQuery,
          variants: queryVariants
        },
        retrieval: {
          requestedTopK: effectiveNormalized.topK,
          hits: toKnowledgeRagTraceHits(processedHits),
          citations: collectKnowledgeRagTraceCitations(processedHits),
          diagnostics: postRetrievalDiagnostics
        },
        diagnostics: postRetrievalDiagnostics,
        metrics: buildRetrievalRuntimeMetrics({
          traceId,
          durationMs: Date.now() - startMs,
          retrievalDurationMs: retrievalDiagnostics.latencyMs,
          hitCount: preHitCount,
          selectedCount: postHitCount,
          contextLengthBytes: contextBundle?.length ?? 0
        })
      });
    }

    return result;
  } catch (error) {
    recordRetrievalEvent(observer, {
      eventId: makeTraceEventId(traceId, 'runtime.run.fail'),
      traceId,
      name: 'runtime.run.fail',
      stage: 'retrieval',
      occurredAt: new Date().toISOString(),
      error: toKnowledgeRagTraceError(error, 'retrieval')
    });

    if (startTrace) {
      tryFinishKnowledgeRagTrace(observer, traceId, {
        status: 'failed',
        endedAt: new Date().toISOString()
      });
    }

    throw error;
  }
}

function recordRetrievalEvent(observer: KnowledgeRagObserver | undefined, input: unknown): void {
  tryRecordKnowledgeRagEvent(observer, input);
}

function buildRetrievalRuntimeMetrics(input: {
  traceId: string;
  durationMs: number;
  retrievalDurationMs: number;
  hitCount: number;
  selectedCount: number;
  contextLengthBytes: number;
}): KnowledgeRagMetric[] {
  return [
    { traceId: input.traceId, name: 'runtime.duration_ms', value: input.durationMs, unit: 'ms', stage: 'retrieval' },
    {
      traceId: input.traceId,
      name: 'retrieval.duration_ms',
      value: input.retrievalDurationMs,
      unit: 'ms',
      stage: 'retrieval'
    },
    {
      traceId: input.traceId,
      name: 'retrieval.hit_count',
      value: input.hitCount,
      unit: 'count',
      stage: 'retrieval'
    },
    {
      traceId: input.traceId,
      name: 'retrieval.selected_count',
      value: input.selectedCount,
      unit: 'count',
      stage: 'post-retrieval'
    },
    {
      traceId: input.traceId,
      name: 'context.length_bytes',
      value: input.contextLengthBytes,
      unit: 'bytes',
      stage: 'context-assembly'
    }
  ];
}

function makeTraceEventId(traceId: string, name: string): string {
  return buildKnowledgeRagEventId(traceId, name);
}
