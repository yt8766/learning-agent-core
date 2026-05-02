import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { KnowledgeChatRoutingError, resolveKnowledgeChatRoute } from '@agent/knowledge';

import type {
  DocumentChunkRecord,
  KnowledgeChatCitation,
  KnowledgeChatResponse,
  KnowledgeDocumentRecord
} from './domain/knowledge-document.types';
import type { NormalizedKnowledgeChatRequest } from './knowledge-document-chat.helpers';
import { KnowledgeServiceError } from './knowledge.errors';
import { KnowledgeTraceService } from './knowledge-trace.service';
import type { KnowledgeActor } from './knowledge.service';
import type { KnowledgeRepository } from './repositories/knowledge.repository';
import type { KnowledgeSdkRuntimeProviderValue } from './runtime/knowledge-sdk-runtime.provider';

@Injectable()
export class KnowledgeRagService {
  constructor(
    private readonly repository: KnowledgeRepository,
    private readonly sdkRuntime: KnowledgeSdkRuntimeProviderValue,
    private readonly traces: KnowledgeTraceService
  ) {}

  async answer(actor: KnowledgeActor, request: NormalizedKnowledgeChatRequest): Promise<KnowledgeChatResponse> {
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
      const response = this.sdkRuntime.enabled
        ? await this.answerWithSdkRuntime(request, route.knowledgeBaseIds, traceId)
        : await this.answerWithRepositoryFallback(request, route.knowledgeBaseIds, traceId);
      this.traces.finishTrace(traceId, 'ok');
      return {
        ...response,
        traceId,
        assistantMessage: { ...response.assistantMessage, traceId },
        route: {
          requestedMentions: readRequestedMentions(request),
          selectedKnowledgeBaseIds: route.knowledgeBaseIds,
          reason: toStableRouteReason(route.reason)
        },
        diagnostics: {
          normalizedQuery: request.message.trim(),
          queryVariants: [request.message.trim()],
          retrievalMode: response.citations.length > 0 ? 'hybrid' : 'none',
          hitCount: response.citations.length,
          contextChunkCount: response.citations.length
        }
      };
    } catch (error) {
      this.traces.finishTrace(traceId, 'error');
      throw error;
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

  private async answerWithRepositoryFallback(
    request: NormalizedKnowledgeChatRequest,
    targetBaseIds: string[],
    traceId: string
  ): Promise<KnowledgeChatResponse> {
    const documents = (
      await Promise.all(targetBaseIds.map(baseId => this.repository.listDocumentsForBase(baseId)))
    ).flat();
    const chunksByDocument = await Promise.all(
      documents.map(async document => ({
        document,
        chunks: await this.repository.listChunks(document.id)
      }))
    );
    const citations = chunksByDocument
      .flatMap(({ document, chunks }) => chunks.map(chunk => toRepositoryCitation(document, chunk, request.message)))
      .filter(citation => citation.score > 0)
      .sort((left, right) => right.score - left.score)
      .slice(0, 5);

    this.traces.addSpan(traceId, {
      name: 'retrieve',
      status: 'ok',
      attributes: { retrievalMode: citations.length > 0 ? 'hybrid' : 'none', hitCount: citations.length }
    });
    const answer =
      citations.length > 0 ? citations.map(citation => citation.quote).join('\n\n') : '未在当前知识库中找到足够依据。';
    this.traces.addSpan(traceId, {
      name: 'generate',
      status: 'ok',
      attributes: { contextChunkCount: citations.length }
    });

    return createChatResponse(request, answer, citations, traceId);
  }

  private async answerWithSdkRuntime(
    request: NormalizedKnowledgeChatRequest,
    targetBaseIds: string[],
    traceId: string
  ): Promise<KnowledgeChatResponse> {
    try {
      const embedding = await this.sdkRuntime.runtime.embeddingProvider.embedText({ text: request.message });
      const searchResults = await Promise.all(
        targetBaseIds.map(async baseId =>
          this.sdkRuntime.runtime.vectorStore.search({
            embedding: embedding.embedding,
            topK: 5,
            filters: {
              tenantId: await this.resolveTenantId(baseId),
              knowledgeBaseId: baseId,
              query: request.message
            }
          })
        )
      );
      const citations = searchResults
        .flatMap(result => result.hits.map(projectVectorHitToCitation).filter(isDefined))
        .sort((left, right) => right.score - left.score)
        .slice(0, 5);
      this.traces.addSpan(traceId, {
        name: 'retrieve',
        status: 'ok',
        attributes: { retrievalMode: citations.length > 0 ? 'hybrid' : 'none', hitCount: citations.length }
      });
      const generated = await this.sdkRuntime.runtime.chatProvider.generate({
        messages: buildSdkChatMessages(request.message, citations),
        metadata: {
          knowledgeBaseIds: targetBaseIds,
          citationCount: citations.length
        }
      });
      this.traces.addSpan(traceId, {
        name: 'generate',
        status: 'ok',
        attributes: { contextChunkCount: citations.length }
      });

      return createChatResponse(request, generated.text, citations, traceId);
    } catch (error) {
      throw new KnowledgeServiceError('knowledge_chat_failed', getErrorMessage(error));
    }
  }

  private async resolveTenantId(baseId: string): Promise<string> {
    const [document] = await this.repository.listDocumentsForBase(baseId);
    return document?.workspaceId ?? 'default';
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

function buildSdkChatMessages(message: string, citations: KnowledgeChatCitation[]) {
  const context =
    citations.length > 0
      ? citations.map((citation, index) => `[${index + 1}] ${citation.title}\n${citation.quote}`).join('\n\n')
      : '未检索到可引用片段。';

  return [
    {
      role: 'system' as const,
      content: '你是知识库问答助手。必须只基于提供的 citations/context 回答；依据不足时明确说明依据不足。'
    },
    {
      role: 'system' as const,
      name: 'developer',
      content: `Context citations:\n${context}`
    },
    {
      role: 'user' as const,
      content: message
    }
  ];
}

function createChatResponse(
  request: NormalizedKnowledgeChatRequest,
  answer: string,
  citations: KnowledgeChatCitation[],
  traceId: string
): KnowledgeChatResponse {
  const now = new Date().toISOString();
  const conversationId = request.conversationId ?? `conv_${randomUUID()}`;

  return {
    conversationId,
    userMessage: {
      id: `msg_${randomUUID()}`,
      conversationId,
      role: 'user',
      content: request.message,
      createdAt: now
    },
    assistantMessage: {
      id: `msg_${randomUUID()}`,
      conversationId,
      role: 'assistant',
      content: answer,
      citations,
      traceId,
      createdAt: now
    },
    answer,
    citations,
    traceId
  };
}

function toRepositoryCitation(
  document: KnowledgeDocumentRecord,
  chunk: DocumentChunkRecord,
  message: string
): KnowledgeChatCitation {
  return {
    id: `cit_${document.id}_${chunk.id}`,
    documentId: document.id,
    chunkId: chunk.id,
    title: document.title,
    quote: truncate(chunk.content, 160),
    score: scoreChunk(chunk.content, message)
  };
}

function projectVectorHitToCitation(hit: {
  id: string;
  score: number;
  content?: string;
  metadata?: Record<string, unknown>;
}): KnowledgeChatCitation | undefined {
  const documentId = readString(hit.metadata, 'documentId') ?? readString(hit.metadata, 'document_id');
  const quote = hit.content?.trim();
  if (!documentId || !quote) {
    return undefined;
  }
  const title =
    readString(hit.metadata, 'title') ?? readString(hit.metadata, 'filename') ?? readString(hit.metadata, 'fileName');
  return {
    id: `cit_${documentId}_${hit.id}_${readNumber(hit.metadata, 'ordinal') ?? 0}`,
    documentId,
    chunkId: hit.id,
    title: title ?? documentId,
    quote,
    score: hit.score
  };
}

function readRequestedMentions(request: NormalizedKnowledgeChatRequest): string[] {
  return (request.mentions ?? []).map(mention => mention.label ?? mention.id).filter(isPresent);
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

function scoreChunk(content: string, message: string): number {
  const queryTerms = tokenize(message);
  if (queryTerms.length === 0) {
    return 0;
  }
  const contentTerms = new Set(tokenize(content));
  const matches = queryTerms.filter(term => contentTerms.has(term)).length;
  return matches / queryTerms.length;
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9\u4e00-\u9fa5]+/u)
    .map(term => term.trim())
    .filter(term => term.length > 1);
}

function truncate(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}...` : value;
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

function isPresent(value: string | undefined): value is string {
  return typeof value === 'string' && value.length > 0;
}

function readString(source: Record<string, unknown> | undefined, key: string): string | undefined {
  const value = source?.[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function readNumber(source: Record<string, unknown> | undefined, key: string): number | undefined {
  const value = source?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return 'Knowledge chat SDK runtime failed.';
}
