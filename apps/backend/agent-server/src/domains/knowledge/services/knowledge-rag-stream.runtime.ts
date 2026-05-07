import { randomUUID } from 'node:crypto';

import type { Citation, KnowledgeRagResult, KnowledgeRagStreamEvent, RetrievalHit } from '@agent/knowledge';

import type { KnowledgeChatCitation, KnowledgeChatResponse, RagModelProfile } from '../domain/knowledge-document.types';
import { KnowledgeRagSdkFacade } from '../rag/knowledge-rag-sdk.facade';
import type { KnowledgeRepository } from '../repositories/knowledge.repository';
import type { KnowledgeSdkRuntimeProviderValue } from '../runtime/knowledge-sdk-runtime.provider';
import type { KnowledgeActor } from './knowledge-base.service';
import type { NormalizedKnowledgeChatRequest } from './knowledge-rag.service';
import type { KnowledgeTraceService } from './knowledge-trace.service';

export interface RankedKnowledgeChunk {
  chunk: { id: string; content: string };
  documentId: string;
  title: string;
  score: number;
}

export interface KnowledgeRagStreamRouteContext {
  requestedMentions: string[];
  selectedKnowledgeBaseIds: string[];
  accessibleBases: Awaited<ReturnType<KnowledgeRepository['listBasesForUser']>>;
  reason: 'legacy-ids' | 'fallback-all';
}

export interface KnowledgeRagRouteRecord {
  requestedMentions: string[];
  selectedKnowledgeBaseIds: string[];
  reason: 'legacy-ids' | 'fallback-all';
}

export async function* runKnowledgeRagStream(input: {
  actor: KnowledgeActor;
  request: NormalizedKnowledgeChatRequest;
  conversationId: string;
  modelProfile?: RagModelProfile;
  route: KnowledgeRagStreamRouteContext;
  routeRecord: KnowledgeRagRouteRecord;
  traceId: string;
  repository: KnowledgeRepository;
  traces: KnowledgeTraceService;
  sdkRuntime?: KnowledgeSdkRuntimeProviderValue;
  searchChunks: (knowledgeBaseIds: string[], query: string) => Promise<RankedKnowledgeChunk[]>;
}): AsyncIterable<KnowledgeRagStreamEvent> {
  if (input.sdkRuntime?.enabled) {
    yield* streamWithSdk(input as typeof input & { sdkRuntime: KnowledgeSdkRuntimeProviderValue & { enabled: true } });
    return;
  }

  yield* streamWithLocalSearch(input);
}

function buildFallbackAnswer(message: string, rankedChunks: RankedKnowledgeChunk[]): string {
  if (rankedChunks.length === 0) {
    return `没有在当前知识库中找到与“${message}”直接相关的内容。`;
  }
  return rankedChunks.map((item, index) => `${index + 1}. ${item.chunk.content}`).join('\n');
}

export { buildFallbackAnswer };

async function* streamWithSdk(input: {
  actor: KnowledgeActor;
  request: NormalizedKnowledgeChatRequest;
  conversationId: string;
  modelProfile?: RagModelProfile;
  route: KnowledgeRagStreamRouteContext;
  routeRecord: KnowledgeRagRouteRecord;
  traceId: string;
  repository: KnowledgeRepository;
  traces: KnowledgeTraceService;
  sdkRuntime: KnowledgeSdkRuntimeProviderValue & { enabled: true };
}): AsyncIterable<KnowledgeRagStreamEvent> {
  const facade = new KnowledgeRagSdkFacade(input.repository, input.sdkRuntime);
  for await (const event of facade.stream({
    actor: input.actor,
    request: input.request,
    accessibleBases: input.route.accessibleBases,
    preferredKnowledgeBaseIds: input.route.selectedKnowledgeBaseIds,
    modelProfile: input.modelProfile,
    traceId: input.traceId,
    routeReason: input.route.reason
  })) {
    if (event.type === 'retrieval.completed') {
      input.traces.addSpan(input.traceId, {
        name: 'retrieve',
        status: 'ok',
        attributes: {
          retrievalMode: event.retrieval.diagnostics?.effectiveSearchMode ?? 'none',
          hitCount: event.retrieval.hits.length
        }
      });
    }
    if (event.type === 'answer.completed') {
      input.traces.addSpan(input.traceId, {
        name: 'generate',
        status: 'ok',
        attributes: { contextChunkCount: event.answer.citations.length }
      });
    }
    if (event.type === 'rag.completed') {
      await persistStreamedAssistantMessage({ ...input, result: event.result });
      input.traces.finishTrace(input.traceId, 'ok');
    }
    if (event.type === 'rag.error') {
      input.traces.finishTrace(input.traceId, 'error');
    }
    yield event;
  }
}

async function* streamWithLocalSearch(input: {
  actor: KnowledgeActor;
  request: NormalizedKnowledgeChatRequest;
  conversationId: string;
  modelProfile?: RagModelProfile;
  route: KnowledgeRagStreamRouteContext;
  routeRecord: KnowledgeRagRouteRecord;
  traceId: string;
  repository: KnowledgeRepository;
  traces: KnowledgeTraceService;
  searchChunks: (knowledgeBaseIds: string[], query: string) => Promise<RankedKnowledgeChunk[]>;
}): AsyncIterable<KnowledgeRagStreamEvent> {
  const runId = `rag_${randomUUID()}`;
  const startedAt = Date.now();
  const message = input.request.message;
  yield { type: 'rag.started', runId };
  yield { type: 'planner.started', runId };

  const plan = {
    id: `plan_${randomUUID()}`,
    originalQuery: message,
    queryVariants: [message],
    selectedKnowledgeBaseIds: input.route.selectedKnowledgeBaseIds,
    searchMode: 'keyword-only' as const,
    selectionReason:
      input.route.reason === 'legacy-ids'
        ? 'Selected by explicit unified knowledge chat route.'
        : 'Selected all accessible knowledge bases by unified knowledge chat fallback.',
    confidence: 1,
    fallbackPolicy: 'selected-only' as const,
    routingDecisions: input.route.accessibleBases.map(base => ({
      knowledgeBaseId: base.id,
      selected: input.route.selectedKnowledgeBaseIds.includes(base.id),
      source: 'deterministic' as const,
      reason: input.route.selectedKnowledgeBaseIds.includes(base.id)
        ? 'Selected by unified knowledge chat route.'
        : 'Not selected by unified knowledge chat route.'
    })),
    diagnostics: {
      planner: 'deterministic' as const,
      consideredKnowledgeBaseCount: input.route.accessibleBases.length,
      rewriteApplied: false,
      fallbackApplied: input.route.reason === 'fallback-all'
    }
  };
  yield { type: 'planner.completed', runId, plan };
  yield { type: 'retrieval.started', runId, plan };

  const rankedChunks = await input.searchChunks(input.route.selectedKnowledgeBaseIds, message);
  const retrieval = {
    hits: rankedChunks.map(toRetrievalHit),
    total: rankedChunks.length,
    citations: rankedChunks.map(toRagCitation),
    contextBundle: rankedChunks.map(item => item.chunk.content).join('\n\n'),
    diagnostics: {
      normalizedQuery: message,
      queryVariants: [message],
      effectiveSearchMode: rankedChunks.length > 0 ? ('keyword' as const) : ('none' as const),
      keywordHitCount: rankedChunks.length,
      finalHitCount: rankedChunks.length
    }
  };
  yield { type: 'retrieval.completed', runId, retrieval };
  input.traces.addSpan(input.traceId, {
    name: 'retrieve',
    status: 'ok',
    attributes: {
      retrievalMode: rankedChunks.length > 0 ? 'keyword-only' : 'none',
      hitCount: rankedChunks.length
    }
  });

  yield { type: 'answer.started', runId };
  const answerText = buildFallbackAnswer(message, rankedChunks);
  yield { type: 'answer.delta', runId, delta: answerText };
  const answer = {
    text: answerText,
    noAnswer: rankedChunks.length === 0,
    citations: retrieval.citations,
    diagnostics: {
      durationMs: 0,
      groundedCitationCount: retrieval.citations.length,
      ...(rankedChunks.length === 0 ? { noAnswerReason: 'no_hits' as const } : {})
    }
  };
  yield { type: 'answer.completed', runId, answer };
  input.traces.addSpan(input.traceId, {
    name: 'generate',
    status: 'ok',
    attributes: { contextChunkCount: rankedChunks.length }
  });

  const result = {
    runId,
    plan,
    retrieval,
    answer,
    diagnostics: { durationMs: Math.max(0, Date.now() - startedAt) }
  };
  await persistStreamedAssistantMessage({ ...input, result });
  input.traces.finishTrace(input.traceId, 'ok');
  yield { type: 'rag.completed', runId, result };
}

async function persistStreamedAssistantMessage(input: {
  actor: KnowledgeActor;
  conversationId: string;
  modelProfile?: RagModelProfile;
  traceId: string;
  result: KnowledgeRagResult;
  routeRecord: KnowledgeRagRouteRecord;
  repository: KnowledgeRepository;
}): Promise<void> {
  await input.repository.appendChatMessage({
    conversationId: input.conversationId,
    userId: input.actor.userId,
    role: 'assistant',
    content: input.result.answer.text,
    modelProfileId: input.modelProfile?.id,
    traceId: input.traceId,
    citations: toChatCitations(input.result),
    route: input.routeRecord,
    diagnostics: {
      normalizedQuery: input.result.retrieval.diagnostics?.normalizedQuery ?? input.result.plan.originalQuery,
      queryVariants: input.result.retrieval.diagnostics?.queryVariants ?? input.result.plan.queryVariants,
      retrievalMode: toChatRetrievalMode(input.result),
      hitCount: input.result.retrieval.hits.length,
      contextChunkCount: input.result.retrieval.hits.length
    }
  });
}

function toRagCitation(item: RankedKnowledgeChunk): Citation {
  return {
    sourceId: item.documentId,
    chunkId: item.chunk.id,
    title: item.title,
    uri: `knowledge://${item.documentId}#${item.chunk.id}`,
    quote: item.chunk.content,
    sourceType: 'user-upload',
    trustClass: 'internal'
  };
}

function toRetrievalHit(item: RankedKnowledgeChunk): RetrievalHit {
  const citation = toRagCitation(item);
  return {
    chunkId: item.chunk.id,
    documentId: item.documentId,
    sourceId: item.documentId,
    title: item.title,
    uri: citation.uri,
    sourceType: citation.sourceType,
    trustClass: citation.trustClass,
    content: item.chunk.content,
    score: item.score,
    citation
  };
}

function toChatCitations(result: KnowledgeRagResult): KnowledgeChatCitation[] {
  return result.answer.citations
    .map(citation => {
      const hit = result.retrieval.hits.find(
        item => item.sourceId === citation.sourceId && item.chunkId === citation.chunkId
      );
      if (!hit || !citation.quote) {
        return undefined;
      }
      return {
        id: `cit_${hit.documentId}_${hit.chunkId}`,
        documentId: hit.documentId,
        chunkId: hit.chunkId,
        title: citation.title,
        quote: citation.quote,
        score: hit.score
      };
    })
    .filter(isDefined);
}

function toChatRetrievalMode(
  result: KnowledgeRagResult
): NonNullable<KnowledgeChatResponse['diagnostics']>['retrievalMode'] {
  if (result.retrieval.hits.length === 0) {
    return 'none';
  }
  switch (result.retrieval.diagnostics?.effectiveSearchMode) {
    case 'keyword':
    case 'fallback-keyword':
      return 'keyword-only';
    case 'vector':
      return 'vector-only';
    case 'hybrid':
      return 'hybrid';
    case 'none':
      return 'none';
    default:
      return 'hybrid';
  }
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}
