import { randomUUID } from 'node:crypto';

import type { KnowledgeBase } from '@agent/core';
import {
  createInMemoryKnowledgeRagObserver,
  runKnowledgeRag,
  streamKnowledgeRag,
  type KnowledgeRagObserver,
  type KnowledgeRagAnswer,
  type KnowledgeRagEffectiveSearchMode,
  type KnowledgeRagPolicy,
  type KnowledgeRagResult,
  type KnowledgeRagTrace,
  type KnowledgeRagStreamEvent
} from '@agent/knowledge';

import type { KnowledgeChatResponse, RagModelProfile } from '../domain/knowledge-document.types';
import type { KnowledgeRepository } from '../repositories/knowledge.repository';
import type { KnowledgeSdkRuntimeProviderValue } from '../runtime/knowledge-sdk-runtime.provider';
import type { KnowledgeActor } from '../services/knowledge-base.service';
import { KnowledgeServiceError } from '../services/knowledge-service.error';
import type { NormalizedKnowledgeChatRequest } from '../services/knowledge-rag.service';
import { createKnowledgeRagPlannerProvider } from './knowledge-rag-planner.provider';
import {
  createDeterministicKnowledgeRagPlannerProvider,
  createKnowledgeRagAnswerProvider,
  readKnowledgeRagAnswerProviderError
} from './knowledge-rag-sdk.providers';
import { KnowledgeDomainSearchServiceAdapter } from './knowledge-domain-search-service.adapter';

export interface KnowledgeRagSdkFacadeAnswerInput {
  actor: KnowledgeActor;
  request: NormalizedKnowledgeChatRequest;
  accessibleBases: KnowledgeBase[];
  preferredKnowledgeBaseIds: string[];
  modelProfile?: RagModelProfile;
  traceId: string;
  routeReason: NonNullable<KnowledgeChatResponse['route']>['reason'];
  onTraceComplete?: (trace: KnowledgeRagTrace) => void;
}

export class KnowledgeRagSdkFacade {
  constructor(
    private readonly repository: KnowledgeRepository,
    private readonly sdkRuntime: KnowledgeSdkRuntimeProviderValue
  ) {}

  async answer(input: KnowledgeRagSdkFacadeAnswerInput): Promise<KnowledgeChatResponse> {
    try {
      const answerProvider = createKnowledgeRagAnswerProvider(this.sdkRuntime, input.modelProfile);
      const result = await runKnowledgeRag({
        query: input.request.message,
        accessibleKnowledgeBases: await this.toRoutingCandidates(input.accessibleBases),
        policy: createDefaultRagPolicy(),
        plannerProvider: this.createPlannerProvider(input),
        searchService: new KnowledgeDomainSearchServiceAdapter(this.repository, this.sdkRuntime),
        answerProvider,
        metadata: {
          actorUserId: input.actor.userId,
          conversationId: input.request.conversationId ?? null,
          explicitKnowledgeBaseIds: input.preferredKnowledgeBaseIds,
          requestedMentions: readRequestedMentions(input.request)
        }
      });
      const answerProviderError = readKnowledgeRagAnswerProviderError(answerProvider);
      if (answerProviderError) {
        throw answerProviderError;
      }

      return toChatResponse(input.request, result, input.traceId, input.routeReason);
    } catch (error) {
      throw new KnowledgeServiceError('knowledge_chat_failed', getErrorMessage(error));
    }
  }

  async *stream(input: KnowledgeRagSdkFacadeAnswerInput): AsyncIterable<KnowledgeRagStreamEvent> {
    const observer = createInMemoryKnowledgeRagObserver();
    let traceStarted = false;
    let traceProjected = false;
    try {
      const answerProvider = createKnowledgeRagAnswerProvider(this.sdkRuntime, input.modelProfile);
      for await (const event of streamKnowledgeRag({
        query: input.request.message,
        accessibleKnowledgeBases: await this.toRoutingCandidates(input.accessibleBases),
        policy: createDefaultRagPolicy(),
        plannerProvider: this.createPlannerProvider(input),
        searchService: new KnowledgeDomainSearchServiceAdapter(this.repository, this.sdkRuntime),
        answerProvider,
        metadata: {
          actorUserId: input.actor.userId,
          conversationId: input.request.conversationId ?? null,
          explicitKnowledgeBaseIds: input.preferredKnowledgeBaseIds,
          requestedMentions: readRequestedMentions(input.request)
        }
      })) {
        observeSdkStreamEvent(observer, input, event);
        if (event.type === 'rag.started') {
          traceStarted = true;
        }
        if (event.type === 'answer.completed' || event.type === 'rag.completed') {
          const answerProviderError = readKnowledgeRagAnswerProviderError(answerProvider);
          if (answerProviderError) {
            throw answerProviderError;
          }
        }
        if (event.type === 'rag.completed' || event.type === 'rag.error') {
          input.onTraceComplete?.(observer.exportTrace(input.traceId));
          traceProjected = true;
        }
        yield event;
      }
    } catch (error) {
      projectFailedSdkTrace(observer, input, error, traceStarted, traceProjected);
      throw new KnowledgeServiceError('knowledge_chat_failed', getErrorMessage(error));
    }
  }

  private async toRoutingCandidates(accessibleBases: KnowledgeBase[]) {
    return Promise.all(
      accessibleBases.map(async base => {
        const documents = await this.repository.listDocumentsForBase(base.id);
        return {
          id: base.id,
          name: base.name,
          description: base.description,
          tags: [],
          documentCount: documents.length,
          recentDocumentTitles: documents
            .slice()
            .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
            .slice(0, 5)
            .map(document => document.title),
          updatedAt: base.updatedAt
        };
      })
    );
  }

  private createPlannerProvider(input: KnowledgeRagSdkFacadeAnswerInput) {
    if (!this.sdkRuntime.enabled) {
      return createDeterministicKnowledgeRagPlannerProvider({
        preferredKnowledgeBaseIds: input.preferredKnowledgeBaseIds
      });
    }

    return createKnowledgeRagPlannerProvider({
      chatProvider: this.sdkRuntime.runtime.chatProvider,
      modelProfile: input.modelProfile ?? {
        plannerModelId: this.sdkRuntime.runtime.chatProvider.defaultModel
      },
      preferredKnowledgeBaseIds: input.preferredKnowledgeBaseIds
    });
  }
}

function observeSdkStreamEvent(
  observer: KnowledgeRagObserver,
  input: KnowledgeRagSdkFacadeAnswerInput,
  event: KnowledgeRagStreamEvent
): void {
  const occurredAt = new Date().toISOString();
  switch (event.type) {
    case 'rag.started':
      observer.startTrace({
        traceId: input.traceId,
        runId: event.runId,
        operation: 'rag.run',
        status: 'running',
        startedAt: occurredAt,
        query: { text: input.request.message },
        attributes: {
          routeReason: input.routeReason,
          selectedKnowledgeBaseCount: input.preferredKnowledgeBaseIds.length
        }
      });
      break;
    case 'retrieval.completed':
      observer.recordEvent({
        eventId: makeSdkRagEventId(input.traceId, 'runtime.retrieval.complete'),
        traceId: input.traceId,
        name: 'runtime.retrieval.complete',
        stage: 'retrieval',
        occurredAt,
        retrieval: buildTraceRetrievalSnapshot(event.retrieval)
      });
      break;
    case 'answer.completed':
      observer.recordEvent({
        eventId: makeSdkRagEventId(input.traceId, 'runtime.generation.complete'),
        traceId: input.traceId,
        name: 'runtime.generation.complete',
        stage: 'generation',
        occurredAt,
        generation: {
          answerId: event.runId,
          answerText: event.answer.text,
          citedChunkIds: event.answer.citations.map(citation => citation.chunkId),
          groundedCitationRate: event.answer.citations.length > 0 ? 1 : 0
        }
      });
      break;
    case 'rag.completed':
      observer.finishTrace(input.traceId, {
        status: 'succeeded',
        endedAt: occurredAt
      });
      break;
    case 'rag.error':
      observer.recordEvent({
        eventId: makeSdkRagEventId(input.traceId, 'runtime.run.fail'),
        traceId: input.traceId,
        name: 'runtime.run.fail',
        stage: event.stage === 'retrieval' ? 'retrieval' : 'generation',
        occurredAt,
        error: {
          code: event.error.code,
          message: event.error.message,
          retryable: event.error.retryable,
          stage: event.stage === 'retrieval' ? 'retrieval' : 'generation'
        }
      });
      observer.finishTrace(input.traceId, {
        status: 'failed',
        endedAt: occurredAt
      });
      break;
    default:
      break;
  }
}

function projectFailedSdkTrace(
  observer: KnowledgeRagObserver,
  input: KnowledgeRagSdkFacadeAnswerInput,
  error: unknown,
  traceStarted: boolean,
  traceProjected: boolean
): void {
  if (!traceStarted || traceProjected) return;
  const occurredAt = new Date().toISOString();
  const failure = toError(error);
  observer.recordEvent({
    eventId: makeSdkRagEventId(input.traceId, 'runtime.run.fail'),
    traceId: input.traceId,
    name: 'runtime.run.fail',
    stage: 'generation',
    occurredAt,
    error: {
      code: failure.name || 'Error',
      message: failure.message,
      retryable: false,
      stage: 'generation'
    }
  });
  observer.finishTrace(input.traceId, {
    status: 'failed',
    endedAt: occurredAt
  });
  input.onTraceComplete?.(observer.exportTrace(input.traceId));
}

function makeSdkRagEventId(traceId: string, name: string): string {
  return `${traceId}:${name}`;
}

function buildTraceRetrievalSnapshot(retrieval: KnowledgeRagResult['retrieval']): KnowledgeRagTrace['retrieval'] {
  const runtimeDiagnostics = retrieval.diagnostics as Record<string, unknown> | undefined;
  return {
    hits: toTraceHits(retrieval.hits),
    citations: retrieval.citations,
    diagnostics: {
      retrievalMode: toTraceRetrievalMode(retrieval.diagnostics?.effectiveSearchMode),
      candidateCount: (runtimeDiagnostics?.candidateCount as number) ?? retrieval.hits.length,
      selectedCount: retrieval.hits.length,
      dropReasons: runtimeDiagnostics?.dropReasons as Record<string, number> | undefined
    }
  };
}

function toTraceHits(hits: KnowledgeRagResult['retrieval']['hits']) {
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

function toTraceRetrievalMode(
  mode: KnowledgeRagEffectiveSearchMode | undefined
): 'keyword-only' | 'vector-only' | 'hybrid' | 'none' | undefined {
  switch (mode) {
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
      return undefined;
  }
}

function resolveRetrievalMode(
  result: KnowledgeRagResult
): NonNullable<KnowledgeRagAnswer['diagnostics']>['retrievalMode'] {
  if (result.retrieval.hits.length === 0) return 'none';
  return toTraceRetrievalMode(result.retrieval.diagnostics?.effectiveSearchMode) ?? 'hybrid';
}

function toChatResponse(
  request: NormalizedKnowledgeChatRequest,
  result: KnowledgeRagResult,
  traceId: string,
  routeReason: NonNullable<KnowledgeChatResponse['route']>['reason']
): KnowledgeChatResponse {
  const now = new Date().toISOString();
  const conversationId = request.conversationId ?? `conv_${randomUUID()}`;
  const citations = result.answer.citations
    .map(citation => {
      const hit = result.retrieval.hits.find(
        item => item.sourceId === citation.sourceId && item.chunkId === citation.chunkId
      );
      if (!hit || !citation.quote) return undefined;
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

  return {
    conversationId,
    userMessage: { id: `msg_${randomUUID()}`, conversationId, role: 'user', content: request.message, createdAt: now },
    assistantMessage: {
      id: `msg_${randomUUID()}`,
      conversationId,
      role: 'assistant',
      content: result.answer.text,
      citations,
      traceId,
      createdAt: now
    },
    answer: result.answer.text,
    citations,
    traceId,
    route: {
      requestedMentions: readRequestedMentions(request),
      selectedKnowledgeBaseIds: result.plan.selectedKnowledgeBaseIds,
      reason: routeReason
    },
    diagnostics: {
      normalizedQuery: result.retrieval.diagnostics?.normalizedQuery ?? request.message.trim(),
      queryVariants:
        (result.retrieval.diagnostics?.queryVariants?.length ?? 0) > 0
          ? result.retrieval.diagnostics!.queryVariants!
          : [request.message.trim()],
      retrievalMode: resolveRetrievalMode(result),
      hitCount: result.retrieval.hits.length,
      contextChunkCount: result.retrieval.hits.length
    }
  };
}

function createDefaultRagPolicy(): KnowledgeRagPolicy {
  return {
    maxSelectedKnowledgeBases: 5,
    minPlannerConfidence: 0.5,
    defaultSearchMode: 'hybrid',
    fallbackWhenPlannerFails: 'search-all-accessible',
    fallbackWhenLowConfidence: 'search-all-accessible',
    maxQueryVariants: 3,
    retrievalTopK: 5,
    contextBudgetTokens: 4000,
    requireGroundedCitations: true,
    noAnswer: {
      minHitCount: 1,
      allowAnswerWithoutCitation: false,
      responseStyle: 'explicit-insufficient-evidence'
    }
  };
}

function readRequestedMentions(request: NormalizedKnowledgeChatRequest): string[] {
  return (request.mentions ?? []).map(mention => mention.label ?? mention.id).filter(isPresent);
}

function isPresent(value: string | undefined): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : 'Knowledge RAG SDK failed.';
}

function toError(error: unknown): Error {
  if (error instanceof Error) return error;
  return new Error(typeof error === 'string' && error.length > 0 ? error : 'Knowledge RAG SDK failed.');
}
