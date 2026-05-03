import { Injectable } from '@nestjs/common';
import { KnowledgeChatRoutingError, resolveKnowledgeChatRoute, type KnowledgeRagStreamEvent } from '@agent/knowledge';

import type { KnowledgeChatResponse, RagModelProfile } from './domain/knowledge-document.types';
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
    const accessibleBases = await this.repository.listBasesForUser(actor.userId);
    const route = this.resolveRoute({ accessibleBases, request });
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
        request,
        accessibleBases,
        preferredKnowledgeBaseIds: route.reason === 'fallback_all' ? [] : route.knowledgeBaseIds,
        modelProfile,
        traceId,
        routeReason: toStableRouteReason(route.reason)
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
    const accessibleBases = await this.repository.listBasesForUser(actor.userId);
    const route = this.resolveRoute({ accessibleBases, request });
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
        request,
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
