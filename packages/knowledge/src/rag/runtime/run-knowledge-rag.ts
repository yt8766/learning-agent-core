import { randomUUID } from 'node:crypto';

import type { KnowledgeRagMetric } from '../../contracts';
import type { KnowledgeSearchService } from '../../contracts/knowledge-facade';
import type { RetrievalPipelineConfig } from '../../contracts/knowledge-retrieval-runtime';
import {
  tryFinishKnowledgeRagTrace,
  tryRecordKnowledgeRagEvent,
  tryStartKnowledgeRagTrace,
  type KnowledgeRagObserver
} from '../../observability';
import { RagAnswerRuntime } from '../answer';
import { DefaultPreRetrievalPlanner } from '../planning';
import type { KnowledgeAnswerProvider, KnowledgeStructuredPlannerProvider } from '../providers';
import type {
  KnowledgeBaseRoutingCandidate,
  KnowledgeRagEffectiveSearchMode,
  KnowledgeRagJsonValue,
  KnowledgeRagPolicy,
  KnowledgeRagResult
} from '../schemas';
import { KnowledgeRagResultSchema } from '../schemas';
import { RagRetrievalRuntime } from '../retrieval';

export interface KnowledgeRagConversation {
  summary?: string;
  recentMessages?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

export interface KnowledgeRagInput {
  query: string;
  conversation?: KnowledgeRagConversation;
  accessibleKnowledgeBases: KnowledgeBaseRoutingCandidate[];
  policy: KnowledgeRagPolicy;
  plannerProvider: KnowledgeStructuredPlannerProvider;
  searchService: KnowledgeSearchService;
  answerProvider: KnowledgeAnswerProvider;
  pipeline?: RetrievalPipelineConfig;
  metadata?: Record<string, KnowledgeRagJsonValue>;
  now?: () => number;
  idFactory?: () => string;
  observer?: KnowledgeRagObserver;
  traceId?: string;
}

export async function runKnowledgeRag(input: KnowledgeRagInput): Promise<KnowledgeRagResult> {
  const now = input.now ?? Date.now;
  const idFactory = input.idFactory ?? randomUUID;
  const runStartedAt = now();
  const runId = idFactory();
  const traceId = input.traceId ?? runId;

  const planner = new DefaultPreRetrievalPlanner({
    provider: input.plannerProvider,
    now,
    idFactory
  });
  const retrievalRuntime = new RagRetrievalRuntime({
    searchService: input.searchService,
    pipeline: input.pipeline,
    includeDiagnostics: true,
    assembleContext: true
  });
  const answerRuntime = new RagAnswerRuntime({
    provider: input.answerProvider,
    noAnswerPolicy: input.policy.noAnswer
  });

  tryStartKnowledgeRagTrace(input.observer, {
    traceId,
    runId,
    operation: 'rag.run',
    startedAt: new Date(runStartedAt).toISOString(),
    query: { text: input.query },
    attributes: {
      accessibleKnowledgeBaseCount: input.accessibleKnowledgeBases.length
    }
  });

  try {
    recordRagEvent(input.observer, {
      eventId: makeRagEventId(traceId, 'runtime.query.receive'),
      traceId,
      name: 'runtime.query.receive',
      stage: 'pre-retrieval',
      occurredAt: new Date(now()).toISOString(),
      query: { text: input.query }
    });

    const plannerStartedAt = now();
    const plan = await planner.plan({
      query: input.query,
      conversation: input.conversation,
      accessibleKnowledgeBases: input.accessibleKnowledgeBases,
      policy: input.policy,
      metadata: input.metadata
    });
    const plannerDurationMs = elapsedMs(now, plannerStartedAt);

    recordRagEvent(input.observer, {
      eventId: makeRagEventId(traceId, 'runtime.query.preprocess'),
      traceId,
      parentEventId: makeRagEventId(traceId, 'runtime.query.receive'),
      name: 'runtime.query.preprocess',
      stage: 'pre-retrieval',
      occurredAt: new Date(now()).toISOString(),
      query: {
        text: plan.originalQuery,
        normalizedText: getRagPrimaryQuery(plan),
        variants: plan.queryVariants
      },
      attributes: {
        planner: plan.diagnostics.planner,
        selectedKnowledgeBaseCount: plan.selectedKnowledgeBaseIds.length,
        confidence: plan.confidence
      }
    });

    const retrievalStartedAt = now();
    recordRagEvent(input.observer, {
      eventId: makeRagEventId(traceId, 'runtime.retrieval.start'),
      traceId,
      parentEventId: makeRagEventId(traceId, 'runtime.query.preprocess'),
      name: 'runtime.retrieval.start',
      stage: 'retrieval',
      occurredAt: new Date(retrievalStartedAt).toISOString(),
      retrieval: {
        requestedTopK: plan.strategyHints?.topK,
        hits: [],
        citations: []
      }
    });
    const retrieval = await retrievalRuntime.retrieve(plan);
    const retrievalDurationMs = elapsedMs(now, retrievalStartedAt);
    const retrievalDiagnostics = {
      retrievalMode: toTraceRetrievalMode(retrieval.diagnostics?.effectiveSearchMode),
      enabledRetrievers: retrieval.diagnostics?.hybrid?.enabledRetrievers,
      failedRetrievers: retrieval.diagnostics?.hybrid?.failedRetrievers,
      fusionStrategy: retrieval.diagnostics?.hybrid?.fusionStrategy,
      candidateCount: retrieval.diagnostics?.preHitCount ?? retrieval.hits.length,
      selectedCount: retrieval.hits.length,
      latencyMs: retrievalDurationMs
    };

    recordRagEvent(input.observer, {
      eventId: makeRagEventId(traceId, 'runtime.retrieval.complete'),
      traceId,
      parentEventId: makeRagEventId(traceId, 'runtime.retrieval.start'),
      name: 'runtime.retrieval.complete',
      stage: 'retrieval',
      occurredAt: new Date(now()).toISOString(),
      retrieval: {
        requestedTopK: plan.strategyHints?.topK,
        hits: toRagTraceHits(retrieval.hits),
        citations: retrieval.citations,
        diagnostics: retrievalDiagnostics
      }
    });
    recordRagEvent(input.observer, {
      eventId: makeRagEventId(traceId, 'runtime.post_retrieval.select'),
      traceId,
      parentEventId: makeRagEventId(traceId, 'runtime.retrieval.complete'),
      name: 'runtime.post_retrieval.select',
      stage: 'post-retrieval',
      occurredAt: new Date(now()).toISOString(),
      retrieval: {
        requestedTopK: plan.strategyHints?.topK,
        hits: toRagTraceHits(retrieval.hits),
        citations: retrieval.citations,
        diagnostics: retrievalDiagnostics
      }
    });
    recordRagEvent(input.observer, {
      eventId: makeRagEventId(traceId, 'runtime.context_assembly.complete'),
      traceId,
      parentEventId: makeRagEventId(traceId, 'runtime.post_retrieval.select'),
      name: 'runtime.context_assembly.complete',
      stage: 'context-assembly',
      occurredAt: new Date(now()).toISOString(),
      retrieval: {
        requestedTopK: plan.strategyHints?.topK,
        hits: toRagTraceHits(retrieval.hits),
        citations: retrieval.citations,
        diagnostics: retrievalDiagnostics
      },
      attributes: {
        contextAssembled: Boolean(retrieval.contextBundle),
        contextLength: retrieval.contextBundle?.length ?? 0
      }
    });

    const answerStartedAt = now();
    const answer = await answerRuntime.generate(plan, retrieval, {
      metadata: toKnowledgeRagAnswerMetadata(input.metadata)
    });
    const answerDurationMs = elapsedMs(now, answerStartedAt);
    const groundedCitationRate = calculateGroundedCitationRate(answer.citations, retrieval.citations);

    recordRagEvent(input.observer, {
      eventId: makeRagEventId(traceId, 'runtime.generation.complete'),
      traceId,
      parentEventId: makeRagEventId(traceId, 'runtime.context_assembly.complete'),
      name: 'runtime.generation.complete',
      stage: 'generation',
      occurredAt: new Date(now()).toISOString(),
      generation: {
        answerId: runId,
        answerText: answer.text,
        citedChunkIds: answer.citations.map(citation => citation.chunkId),
        groundedCitationRate
      }
    });

    const durationMs = elapsedMs(now, runStartedAt);
    const result = KnowledgeRagResultSchema.parse({
      runId,
      plan,
      retrieval,
      answer,
      diagnostics: {
        durationMs,
        plannerDurationMs,
        retrievalDurationMs,
        answerDurationMs
      }
    });
    const metrics = buildRagRuntimeMetrics({
      traceId,
      durationMs,
      plannerDurationMs,
      retrievalDurationMs,
      answerDurationMs,
      hitCount: retrieval.diagnostics?.preHitCount ?? retrieval.hits.length,
      selectedCount: retrieval.hits.length,
      groundedCitationRate
    });

    tryFinishKnowledgeRagTrace(input.observer, traceId, {
      status: 'succeeded',
      endedAt: new Date(now()).toISOString(),
      query: {
        text: plan.originalQuery,
        normalizedText: getRagPrimaryQuery(plan),
        variants: plan.queryVariants
      },
      retrieval: {
        requestedTopK: plan.strategyHints?.topK,
        hits: toRagTraceHits(retrieval.hits),
        citations: retrieval.citations,
        diagnostics: retrievalDiagnostics
      },
      generation: {
        answerId: runId,
        answerText: answer.text,
        citedChunkIds: answer.citations.map(citation => citation.chunkId),
        groundedCitationRate
      },
      diagnostics: retrievalDiagnostics,
      metrics
    });

    return result;
  } catch (error) {
    recordRagEvent(input.observer, {
      eventId: makeRagEventId(traceId, 'runtime.run.fail'),
      traceId,
      name: 'runtime.run.fail',
      stage: 'generation',
      occurredAt: new Date(now()).toISOString(),
      error: toRagTraceError(error)
    });

    tryFinishKnowledgeRagTrace(input.observer, traceId, {
      status: 'failed',
      endedAt: new Date(now()).toISOString()
    });

    throw error;
  }
}

function elapsedMs(now: () => number, startedAt: number): number {
  return Math.max(0, now() - startedAt);
}

function isScalarRagMetadataValue(value: KnowledgeRagJsonValue): value is string | number | boolean | null {
  return value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
}

export function toKnowledgeRagAnswerMetadata(
  metadata: Record<string, KnowledgeRagJsonValue> | undefined
): Record<string, string | number | boolean | null> | undefined {
  if (!metadata) {
    return undefined;
  }

  const answerMetadata: Record<string, string | number | boolean | null> = {};

  for (const [key, value] of Object.entries(metadata)) {
    if (isScalarRagMetadataValue(value)) {
      answerMetadata[key] = value;
    }
  }

  return Object.keys(answerMetadata).length > 0 ? answerMetadata : undefined;
}

function recordRagEvent(observer: KnowledgeRagObserver | undefined, input: unknown): void {
  tryRecordKnowledgeRagEvent(observer, input);
}

function buildRagRuntimeMetrics(input: {
  traceId: string;
  durationMs: number;
  plannerDurationMs: number;
  retrievalDurationMs: number;
  answerDurationMs: number;
  hitCount: number;
  selectedCount: number;
  groundedCitationRate: number;
}): KnowledgeRagMetric[] {
  return [
    { traceId: input.traceId, name: 'runtime.duration_ms', value: input.durationMs, unit: 'ms', stage: 'generation' },
    {
      traceId: input.traceId,
      name: 'runtime.planner_duration_ms',
      value: input.plannerDurationMs,
      unit: 'ms',
      stage: 'pre-retrieval'
    },
    {
      traceId: input.traceId,
      name: 'retrieval.duration_ms',
      value: input.retrievalDurationMs,
      unit: 'ms',
      stage: 'retrieval'
    },
    {
      traceId: input.traceId,
      name: 'generation.duration_ms',
      value: input.answerDurationMs,
      unit: 'ms',
      stage: 'generation'
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
      name: 'generation.grounded_citation_rate',
      value: input.groundedCitationRate,
      unit: 'ratio',
      stage: 'generation'
    }
  ];
}

function makeRagEventId(traceId: string, name: string): string {
  return `${traceId}:${name}`;
}

function getRagPrimaryQuery(plan: { rewrittenQuery?: string; originalQuery: string }): string {
  const rewrittenQuery = plan.rewrittenQuery?.trim();

  return rewrittenQuery || plan.originalQuery;
}

function calculateGroundedCitationRate(
  answerCitations: Array<{ sourceId: string; chunkId: string }>,
  retrievalCitations: Array<{ sourceId: string; chunkId: string }>
): number {
  if (retrievalCitations.length === 0) {
    return 0;
  }

  const retrievalKeys = new Set(retrievalCitations.map(toCitationKey));
  const groundedAnswerKeys = new Set(answerCitations.map(toCitationKey).filter(key => retrievalKeys.has(key)));

  return Math.min(1, groundedAnswerKeys.size / retrievalKeys.size);
}

function toCitationKey(citation: { sourceId: string; chunkId: string }): string {
  return `${citation.sourceId}\u0000${citation.chunkId}`;
}

function toRagTraceHits(hits: KnowledgeRagResult['retrieval']['hits']): Array<{
  chunkId: string;
  documentId: string;
  sourceId: string;
  knowledgeBaseId?: string;
  rank: number;
  score?: number;
  title?: string;
  uri?: string;
  citation?: KnowledgeRagResult['retrieval']['hits'][number]['citation'];
}> {
  return hits.map((hit, index) => ({
    chunkId: hit.chunkId,
    documentId: hit.documentId,
    sourceId: hit.sourceId,
    knowledgeBaseId: hit.knowledgeBaseId,
    rank: index + 1,
    score: hit.score,
    title: hit.title,
    uri: hit.uri,
    citation: hit.citation
  }));
}

function toRagTraceError(error: unknown): {
  code: string;
  message: string;
  retryable: boolean;
  stage: 'generation';
} {
  return {
    code: error instanceof Error ? error.name || 'Error' : 'UnknownError',
    message: error instanceof Error ? error.message : 'Unknown RAG runtime error',
    retryable: false,
    stage: 'generation'
  };
}

function toTraceRetrievalMode(
  mode: KnowledgeRagEffectiveSearchMode | undefined
): 'keyword-only' | 'vector-only' | 'hybrid' | 'none' | undefined {
  switch (mode) {
    case 'vector':
      return 'vector-only';
    case 'keyword':
    case 'fallback-keyword':
      return 'keyword-only';
    case 'hybrid':
    case 'none':
      return mode;
    default:
      return undefined;
  }
}
