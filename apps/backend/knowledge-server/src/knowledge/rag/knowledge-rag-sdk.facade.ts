import { randomUUID } from 'node:crypto';
import type { KnowledgeBase } from '@agent/core';
import {
  runKnowledgeRag,
  streamKnowledgeRag,
  type KnowledgeRagPolicy,
  type KnowledgeRagResult,
  type KnowledgeRagStreamEvent
} from '@agent/knowledge';

import type { KnowledgeChatResponse } from '../domain/knowledge-document.types';
import type { NormalizedKnowledgeChatRequest } from '../knowledge-document-chat.helpers';
import { KnowledgeServiceError } from '../knowledge.errors';
import type { KnowledgeActor } from '../knowledge.service';
import type { KnowledgeRepository } from '../repositories/knowledge.repository';
import type { KnowledgeSdkRuntimeProviderValue } from '../runtime/knowledge-sdk-runtime.provider';
import {
  createKnowledgeRagAnswerProvider,
  createDeterministicKnowledgeRagPlannerProvider,
  readKnowledgeRagAnswerProviderError
} from './knowledge-rag-sdk.providers';
import { createKnowledgeRagPlannerProvider } from './knowledge-rag-planner.provider';
import { KnowledgeServerSearchServiceAdapter } from './knowledge-server-search-service.adapter';
import type { RagModelProfile } from '../domain/knowledge-document.types';

export interface KnowledgeRagSdkFacadeAnswerInput {
  actor: KnowledgeActor;
  request: NormalizedKnowledgeChatRequest;
  accessibleBases: KnowledgeBase[];
  preferredKnowledgeBaseIds: string[];
  modelProfile?: RagModelProfile;
  traceId: string;
  routeReason: KnowledgeChatResponse['route'] extends { reason: infer Reason } ? Reason : never;
}

export class KnowledgeRagSdkFacade {
  constructor(
    private readonly repository: KnowledgeRepository,
    private readonly sdkRuntime: KnowledgeSdkRuntimeProviderValue
  ) {}

  async answer(input: KnowledgeRagSdkFacadeAnswerInput): Promise<KnowledgeChatResponse> {
    try {
      const answerProvider = createKnowledgeRagAnswerProvider(this.sdkRuntime);
      const result = await runKnowledgeRag({
        query: input.request.message,
        accessibleKnowledgeBases: await this.toRoutingCandidates(input.accessibleBases),
        policy: createDefaultRagPolicy(),
        plannerProvider: this.createPlannerProvider(input),
        searchService: new KnowledgeServerSearchServiceAdapter(this.repository),
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
    const answerProvider = createKnowledgeRagAnswerProvider(this.sdkRuntime);
    for await (const event of streamKnowledgeRag({
      query: input.request.message,
      accessibleKnowledgeBases: await this.toRoutingCandidates(input.accessibleBases),
      policy: createDefaultRagPolicy(),
      plannerProvider: this.createPlannerProvider(input),
      searchService: new KnowledgeServerSearchServiceAdapter(this.repository),
      answerProvider,
      metadata: {
        actorUserId: input.actor.userId,
        conversationId: input.request.conversationId ?? null,
        explicitKnowledgeBaseIds: input.preferredKnowledgeBaseIds,
        requestedMentions: readRequestedMentions(input.request)
      }
    })) {
      if (event.type === 'answer.completed' || event.type === 'rag.completed') {
        const answerProviderError = readKnowledgeRagAnswerProviderError(answerProvider);
        if (answerProviderError) {
          throw new KnowledgeServiceError('knowledge_chat_failed', answerProviderError.message);
        }
      }
      yield event;
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
    if (this.sdkRuntime.enabled && input.preferredKnowledgeBaseIds.length === 0) {
      return createKnowledgeRagPlannerProvider({
        chatProvider: this.sdkRuntime.runtime.chatProvider,
        modelProfile: input.modelProfile ?? this.createRuntimeDefaultModelProfile(),
        preferredKnowledgeBaseIds: input.preferredKnowledgeBaseIds
      });
    }

    return createDeterministicKnowledgeRagPlannerProvider({
      preferredKnowledgeBaseIds: input.preferredKnowledgeBaseIds
    });
  }

  private createRuntimeDefaultModelProfile(): Pick<RagModelProfile, 'plannerModelId'> {
    return {
      plannerModelId: this.sdkRuntime.enabled ? this.sdkRuntime.runtime.chatProvider.defaultModel : 'knowledge-chat'
    };
  }
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
  const userMessage = {
    id: `msg_${randomUUID()}`,
    conversationId,
    role: 'user' as const,
    content: request.message,
    createdAt: now
  };
  const assistantMessage = {
    id: `msg_${randomUUID()}`,
    conversationId,
    role: 'assistant' as const,
    content: result.answer.text,
    citations,
    traceId,
    createdAt: now
  };

  return {
    conversationId,
    userMessage,
    assistantMessage,
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
        (result.retrieval.diagnostics?.queryVariants.length ?? 0 > 0)
          ? (result.retrieval.diagnostics?.queryVariants ?? [])
          : [request.message.trim()],
      retrievalMode: result.retrieval.hits.length > 0 ? 'hybrid' : 'none',
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
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return 'Knowledge RAG SDK failed.';
}
