import { Injectable } from '@nestjs/common';
import { KnowledgeChatRoutingError, resolveKnowledgeChatRoute, type KnowledgeRagStreamEvent } from '@agent/knowledge';

import type {
  KnowledgeChatCitation,
  KnowledgeChatResponse,
  KnowledgeChatConversationRecord,
  RagModelProfile
} from './domain/knowledge-document.types';
import type { NormalizedKnowledgeChatRequest } from './knowledge-document-chat.helpers';
import { KnowledgeServiceError } from './knowledge.errors';
import { KnowledgeTraceService } from './knowledge-trace.service';
import type { KnowledgeActor } from './knowledge.service';
import { KnowledgeRagSdkFacade } from './rag/knowledge-rag-sdk.facade';
import type { KnowledgeRepository } from './repositories/knowledge.repository';
import type { KnowledgeSdkRuntimeProviderValue } from './runtime/knowledge-sdk-runtime.provider';

@Injectable()
export class KnowledgeRagService {
  constructor(
    private readonly repository: KnowledgeRepository,
    private readonly sdkRuntime: KnowledgeSdkRuntimeProviderValue,
    private readonly traces: KnowledgeTraceService
  ) {}

  async answer(
    actor: KnowledgeActor,
    request: NormalizedKnowledgeChatRequest,
    modelProfile?: RagModelProfile
  ): Promise<KnowledgeChatResponse> {
    const conversation = await this.ensureConversation(actor, request, modelProfile);
    const persistedRequest = { ...request, conversationId: conversation.id };
    await this.repository.appendChatMessage({
      conversationId: conversation.id,
      userId: actor.userId,
      role: 'user',
      content: request.message,
      modelProfileId: modelProfile?.id
    });
    const accessibleBases = await this.repository.listBasesForUser(actor.userId);
    const route = this.resolveRoute({ accessibleBases, request: persistedRequest });
    for (const baseId of route.knowledgeBaseIds) {
      await this.assertCanView(actor.userId, baseId);
    }

    const traceId = this.traces.startTrace({
      operation: 'rag.chat',
      knowledgeBaseId: route.knowledgeBaseIds[0]
    });
    this.traces.addSpan(traceId, {
      name: 'route',
      status: 'ok',
      attributes: { reason: route.reason, selectedCount: route.knowledgeBaseIds.length }
    });

    try {
      const response = await new KnowledgeRagSdkFacade(this.repository, this.sdkRuntime).answer({
        actor,
        request: persistedRequest,
        accessibleBases,
        preferredKnowledgeBaseIds: route.reason === 'fallback_all' ? [] : route.knowledgeBaseIds,
        modelProfile,
        traceId,
        routeReason: toStableRouteReason(route.reason)
      });
      await this.repository.appendChatMessage({
        conversationId: conversation.id,
        userId: actor.userId,
        role: 'assistant',
        content: response.answer,
        modelProfileId: modelProfile?.id,
        traceId: response.traceId,
        citations: response.citations,
        route: response.route,
        diagnostics: response.diagnostics
      });
      this.traces.addSpan(traceId, {
        name: 'retrieve',
        status: 'ok',
        attributes: {
          retrievalMode: response.diagnostics?.retrievalMode ?? 'none',
          hitCount: response.diagnostics?.hitCount ?? 0
        }
      });
      this.traces.addSpan(traceId, {
        name: 'generate',
        status: 'ok',
        attributes: { contextChunkCount: response.diagnostics?.contextChunkCount ?? response.citations.length }
      });
      this.traces.finishTrace(traceId, 'ok');
      return response;
    } catch (error) {
      this.traces.finishTrace(traceId, 'error');
      throw error;
    }
  }

  async *stream(
    actor: KnowledgeActor,
    request: NormalizedKnowledgeChatRequest,
    modelProfile?: RagModelProfile
  ): AsyncIterable<KnowledgeRagStreamEvent> {
    const conversation = await this.ensureConversation(actor, request, modelProfile);
    const persistedRequest = { ...request, conversationId: conversation.id };
    await this.repository.appendChatMessage({
      conversationId: conversation.id,
      userId: actor.userId,
      role: 'user',
      content: request.message,
      modelProfileId: modelProfile?.id
    });
    const accessibleBases = await this.repository.listBasesForUser(actor.userId);
    const route = this.resolveRoute({ accessibleBases, request: persistedRequest });
    for (const baseId of route.knowledgeBaseIds) {
      await this.assertCanView(actor.userId, baseId);
    }

    const traceId = this.traces.startTrace({
      operation: 'rag.chat',
      knowledgeBaseId: route.knowledgeBaseIds[0]
    });
    this.traces.addSpan(traceId, {
      name: 'route',
      status: 'ok',
      attributes: { reason: route.reason, selectedCount: route.knowledgeBaseIds.length }
    });
    let traceFinished = false;

    try {
      for await (const event of new KnowledgeRagSdkFacade(this.repository, this.sdkRuntime).stream({
        actor,
        request: persistedRequest,
        accessibleBases,
        preferredKnowledgeBaseIds: route.reason === 'fallback_all' ? [] : route.knowledgeBaseIds,
        modelProfile,
        traceId,
        routeReason: toStableRouteReason(route.reason)
      })) {
        if (event.type === 'retrieval.completed') {
          this.traces.addSpan(traceId, {
            name: 'retrieve',
            status: 'ok',
            attributes: {
              retrievalMode: event.retrieval.hits.length > 0 ? 'hybrid' : 'none',
              hitCount: event.retrieval.hits.length
            }
          });
        }
        if (event.type === 'answer.completed') {
          this.traces.addSpan(traceId, {
            name: 'generate',
            status: 'ok',
            attributes: { contextChunkCount: event.answer.citations.length }
          });
        }
        if (event.type === 'rag.completed') {
          await this.repository.appendChatMessage({
            conversationId: conversation.id,
            userId: actor.userId,
            role: 'assistant',
            content: event.result.answer.text,
            modelProfileId: modelProfile?.id,
            traceId,
            citations: toChatCitations(event.result),
            route: {
              requestedMentions:
                request.mentions?.map(mention => mention.label ?? mention.id ?? '').filter(isPresent) ?? [],
              selectedKnowledgeBaseIds: event.result.plan.selectedKnowledgeBaseIds,
              reason: toStableRouteReason(route.reason)
            },
            diagnostics: {
              normalizedQuery: event.result.retrieval.diagnostics?.normalizedQuery ?? request.message.trim(),
              queryVariants:
                (event.result.retrieval.diagnostics?.queryVariants?.length ?? 0) > 0
                  ? (event.result.retrieval.diagnostics?.queryVariants ?? [])
                  : [request.message.trim()],
              retrievalMode: event.result.retrieval.hits.length > 0 ? 'hybrid' : 'none',
              hitCount: event.result.retrieval.hits.length,
              contextChunkCount: event.result.retrieval.hits.length
            }
          });
          this.traces.finishTrace(traceId, 'ok');
          traceFinished = true;
        }
        if (event.type === 'rag.error') {
          this.traces.finishTrace(traceId, 'error');
          traceFinished = true;
        }
        yield event;
      }
    } catch (error) {
      this.traces.finishTrace(traceId, 'error');
      traceFinished = true;
      throw error;
    } finally {
      if (!traceFinished) {
        this.traces.finishTrace(traceId, 'error');
      }
    }
  }

  private resolveRoute(input: {
    accessibleBases: Awaited<ReturnType<KnowledgeRepository['listBasesForUser']>>;
    request: NormalizedKnowledgeChatRequest;
  }) {
    try {
      return resolveKnowledgeChatRoute({
        accessibleBases: input.accessibleBases,
        legacyBaseIds: [...(input.request.knowledgeBaseIds ?? []), input.request.knowledgeBaseId].filter(isPresent),
        mentions: input.request.mentions,
        message: input.request.message
      });
    } catch (error) {
      if (error instanceof KnowledgeChatRoutingError) {
        throw new KnowledgeServiceError(error.code, error.message);
      }
      throw error;
    }
  }

  private async assertCanView(userId: string, baseId: string): Promise<void> {
    const base = await this.repository.findBase(baseId);
    if (!base) {
      throw new KnowledgeServiceError('knowledge_base_not_found', '知识库不存在');
    }
    const member = await this.repository.findMember(baseId, userId);
    if (!member) {
      throw new KnowledgeServiceError('knowledge_permission_denied', '无权访问该知识库');
    }
  }

  private async ensureConversation(
    actor: KnowledgeActor,
    request: NormalizedKnowledgeChatRequest,
    modelProfile?: RagModelProfile
  ): Promise<KnowledgeChatConversationRecord> {
    const conversations = await this.repository.listChatConversationsForUser(actor.userId);
    const existing = request.conversationId
      ? conversations.items.find(conversation => conversation.id === request.conversationId)
      : undefined;
    if (existing) {
      return existing;
    }
    return this.repository.createChatConversation({
      id: request.conversationId,
      userId: actor.userId,
      title: deriveConversationTitle(request.message),
      activeModelProfileId: modelProfile?.id ?? 'knowledge-rag'
    });
  }
}

function deriveConversationTitle(message: string): string {
  const normalized = message.replace(/\s+/g, ' ').trim();
  return normalized.length > 30 ? `${normalized.slice(0, 30)}...` : normalized || '新会话';
}

function toChatCitations(
  result: Extract<KnowledgeRagStreamEvent, { type: 'rag.completed' }>['result']
): KnowledgeChatCitation[] {
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

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

function toStableRouteReason(reason: ReturnType<typeof resolveKnowledgeChatRoute>['reason']) {
  if (reason === 'legacy_ids') {
    return 'legacy-ids';
  }
  if (reason === 'metadata_match') {
    return 'metadata-match';
  }
  if (reason === 'fallback_all') {
    return 'fallback-all';
  }
  return reason;
}

function isPresent(value: string | undefined): value is string {
  return typeof value === 'string' && value.length > 0;
}
