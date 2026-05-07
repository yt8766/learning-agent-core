import { randomUUID } from 'node:crypto';

import type {
  DocumentChunkRecord,
  KnowledgeChatCitation,
  KnowledgeChatConversationRecord,
  KnowledgeChatResponse,
  RagModelProfile
} from '../domain/knowledge-document.types';
import type { KnowledgeRepository } from '../repositories/knowledge.repository';
import { KnowledgeMemoryRepository } from '../repositories/knowledge-memory.repository';
import type { KnowledgeActor } from './knowledge-base.service';
import { KnowledgeServiceError } from './knowledge-service.error';
import { KnowledgeTraceService } from './knowledge-trace.service';

export interface NormalizedKnowledgeChatRequest {
  conversationId?: string;
  knowledgeBaseId?: string;
  knowledgeBaseIds?: string[];
  mentions?: Array<{ type: 'knowledge_base'; id?: string; label?: string }>;
  message: string;
}

interface RankedChunk {
  chunk: DocumentChunkRecord;
  documentId: string;
  title: string;
  score: number;
}

export class KnowledgeRagService {
  constructor(
    private readonly repository: KnowledgeRepository = new KnowledgeMemoryRepository(),
    private readonly traces: KnowledgeTraceService = new KnowledgeTraceService()
  ) {}

  async answer(
    actor: KnowledgeActor,
    request: NormalizedKnowledgeChatRequest,
    modelProfile?: RagModelProfile
  ): Promise<KnowledgeChatResponse> {
    const message = request.message.trim();
    if (!message) {
      throw new KnowledgeServiceError('knowledge_chat_message_required', '消息不能为空');
    }

    const conversation = await this.ensureConversation(actor, request, modelProfile);
    const userMessage = await this.repository.appendChatMessage({
      conversationId: conversation.id,
      userId: actor.userId,
      role: 'user',
      content: message,
      modelProfileId: modelProfile?.id
    });
    const route = await this.resolveRoute(actor, request);
    const traceId = this.traces.startTrace({
      operation: 'rag.chat',
      knowledgeBaseId: route.selectedKnowledgeBaseIds[0]
    });
    this.traces.addSpan(traceId, {
      name: 'route',
      status: 'ok',
      attributes: {
        reason: route.reason,
        selectedCount: route.selectedKnowledgeBaseIds.length
      }
    });

    try {
      const rankedChunks = await this.searchChunks(route.selectedKnowledgeBaseIds, message);
      const citations = rankedChunks.map(toCitation);
      const diagnostics = {
        normalizedQuery: message,
        queryVariants: [message],
        retrievalMode: rankedChunks.length > 0 ? ('keyword-only' as const) : ('none' as const),
        hitCount: rankedChunks.length,
        contextChunkCount: rankedChunks.length
      };
      const answer = buildAnswer(message, rankedChunks);
      const assistantMessage = await this.repository.appendChatMessage({
        conversationId: conversation.id,
        userId: actor.userId,
        role: 'assistant',
        content: answer,
        modelProfileId: modelProfile?.id,
        traceId,
        citations,
        route,
        diagnostics
      });

      this.traces.addSpan(traceId, {
        name: 'retrieve',
        status: 'ok',
        attributes: {
          retrievalMode: diagnostics.retrievalMode,
          hitCount: diagnostics.hitCount
        }
      });
      this.traces.addSpan(traceId, {
        name: 'generate',
        status: 'ok',
        attributes: { contextChunkCount: diagnostics.contextChunkCount }
      });
      this.traces.finishTrace(traceId, 'ok');

      return {
        conversationId: conversation.id,
        userMessage,
        assistantMessage,
        answer,
        citations,
        route,
        diagnostics,
        traceId
      };
    } catch (error) {
      this.traces.finishTrace(traceId, 'error');
      throw error;
    }
  }

  private async resolveRoute(actor: KnowledgeActor, request: NormalizedKnowledgeChatRequest) {
    const legacyBaseIds = [...(request.knowledgeBaseIds ?? []), request.knowledgeBaseId].filter(isPresent);
    const mentionBaseIds = request.mentions?.map(mention => mention.id).filter(isPresent) ?? [];
    const requestedIds = legacyBaseIds.length > 0 ? legacyBaseIds : mentionBaseIds;
    const accessibleBases = await this.repository.listBasesForUser(actor.userId);
    const accessibleIds = new Set(accessibleBases.map(base => base.id));
    const selectedKnowledgeBaseIds = requestedIds.length > 0 ? requestedIds : [...accessibleIds];

    for (const baseId of selectedKnowledgeBaseIds) {
      const base = await this.repository.findBase(baseId);
      if (!base) {
        throw new KnowledgeServiceError('knowledge_base_not_found', '知识库不存在');
      }
      if (!accessibleIds.has(baseId)) {
        throw new KnowledgeServiceError('knowledge_permission_denied', '无权访问该知识库');
      }
    }

    return {
      requestedMentions: request.mentions?.map(mention => mention.label ?? mention.id ?? '').filter(isPresent) ?? [],
      selectedKnowledgeBaseIds,
      reason: requestedIds.length > 0 ? ('legacy-ids' as const) : ('fallback-all' as const)
    };
  }

  private async searchChunks(knowledgeBaseIds: string[], query: string): Promise<RankedChunk[]> {
    const queryTerms = tokenize(query);
    const rankedChunks: RankedChunk[] = [];

    for (const knowledgeBaseId of knowledgeBaseIds) {
      const documents = await this.repository.listDocumentsForBase(knowledgeBaseId);
      for (const document of documents) {
        const chunks = await this.repository.listChunks(document.id);
        for (const chunk of chunks) {
          const score = scoreChunk(chunk.content, queryTerms);
          if (score > 0) {
            rankedChunks.push({ chunk, documentId: document.id, title: document.title, score });
          }
        }
      }
    }

    return rankedChunks.sort((left, right) => right.score - left.score).slice(0, 3);
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

function toCitation(item: RankedChunk): KnowledgeChatCitation {
  return {
    id: `cit_${randomUUID()}`,
    documentId: item.documentId,
    chunkId: item.chunk.id,
    title: item.title,
    quote: item.chunk.content,
    score: item.score
  };
}

function buildAnswer(message: string, rankedChunks: RankedChunk[]): string {
  if (rankedChunks.length === 0) {
    return `没有在当前知识库中找到与“${message}”直接相关的内容。`;
  }
  return rankedChunks.map((item, index) => `${index + 1}. ${item.chunk.content}`).join('\n');
}

function deriveConversationTitle(message: string): string {
  const normalized = message.replace(/\s+/g, ' ').trim();
  return normalized.length > 30 ? `${normalized.slice(0, 30)}...` : normalized || '新会话';
}

function scoreChunk(content: string, queryTerms: string[]): number {
  const normalized = content.toLowerCase();
  const matched = queryTerms.filter(term => normalized.includes(term)).length;
  return queryTerms.length > 0 ? matched / queryTerms.length : 0;
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9\u4e00-\u9fa5]+/u)
    .map(item => item.trim())
    .filter(isPresent);
}

function isPresent(value: string | undefined): value is string {
  return typeof value === 'string' && value.length > 0;
}
