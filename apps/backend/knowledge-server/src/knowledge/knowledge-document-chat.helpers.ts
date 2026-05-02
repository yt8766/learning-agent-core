import { randomUUID } from 'node:crypto';
import { KnowledgeChatRoutingError, resolveKnowledgeChatRoute } from '@agent/knowledge';

import type {
  DocumentChunkRecord,
  KnowledgeChatCitation,
  KnowledgeChatRequest,
  KnowledgeChatResponse,
  KnowledgeDocumentRecord
} from './domain/knowledge-document.types';
import { KnowledgeServiceError } from './knowledge.errors';
import type { KnowledgeSdkRuntimeProviderValue } from './runtime/knowledge-sdk-runtime.provider';
import type { KnowledgeRepository } from './repositories/knowledge.repository';

export interface NormalizedKnowledgeChatRequest {
  conversationId?: string;
  knowledgeBaseId?: string;
  knowledgeBaseIds?: string[];
  mentions?: KnowledgeChatRequest['metadata']['mentions'];
  message: string;
}

export function normalizeChatRequest(input: KnowledgeChatRequest): NormalizedKnowledgeChatRequest {
  const message = input.message?.trim() || latestUserMessage(input.messages);
  if (!message) {
    throw new KnowledgeServiceError('knowledge_chat_message_required', '消息不能为空');
  }
  return {
    conversationId: input.metadata?.conversationId ?? input.conversationId,
    knowledgeBaseId: input.metadata?.knowledgeBaseId ?? input.knowledgeBaseId,
    knowledgeBaseIds: normalizeKnowledgeBaseIds(input.metadata?.knowledgeBaseIds ?? input.knowledgeBaseIds),
    mentions: input.metadata?.mentions,
    message
  };
}

export function resolveChatTargetBaseIds(input: Parameters<typeof resolveKnowledgeChatRoute>[0]): string[] {
  try {
    return resolveKnowledgeChatRoute(input).knowledgeBaseIds;
  } catch (error) {
    if (error instanceof KnowledgeChatRoutingError) {
      throw new KnowledgeServiceError(error.code, error.message);
    }
    throw error;
  }
}

export async function answerKnowledgeChat(input: {
  repository: KnowledgeRepository;
  sdkRuntime: KnowledgeSdkRuntimeProviderValue;
  request: NormalizedKnowledgeChatRequest;
  targetBaseIds: string[];
}): Promise<KnowledgeChatResponse> {
  if (!input.sdkRuntime.enabled) {
    return answerWithRepositoryFallback(input.repository, input.request, input.targetBaseIds);
  }
  return answerWithSdkRuntime(input.repository, input.sdkRuntime, input.request, input.targetBaseIds);
}

async function answerWithRepositoryFallback(
  repository: KnowledgeRepository,
  request: NormalizedKnowledgeChatRequest,
  targetBaseIds: string[]
): Promise<KnowledgeChatResponse> {
  const documents = (await Promise.all(targetBaseIds.map(baseId => repository.listDocumentsForBase(baseId)))).flat();
  const chunksByDocument = await Promise.all(
    documents.map(async document => ({
      document,
      chunks: await repository.listChunks(document.id)
    }))
  );
  const citations = chunksByDocument
    .flatMap(({ document, chunks }) => chunks.map(chunk => toRepositoryCitation(document, chunk, request.message)))
    .filter(citation => citation.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 5);

  const answer =
    citations.length > 0 ? citations.map(citation => citation.quote).join('\n\n') : '未在当前知识库中找到足够依据。';

  return createChatResponse(request, answer, citations);
}

async function answerWithSdkRuntime(
  repository: KnowledgeRepository,
  sdkRuntime: Extract<KnowledgeSdkRuntimeProviderValue, { enabled: true }>,
  request: NormalizedKnowledgeChatRequest,
  targetBaseIds: string[]
): Promise<KnowledgeChatResponse> {
  try {
    const embedding = await sdkRuntime.runtime.embeddingProvider.embedText({ text: request.message });
    const searchResults = await Promise.all(
      targetBaseIds.map(async baseId =>
        sdkRuntime.runtime.vectorStore.search({
          embedding: embedding.embedding,
          topK: 5,
          filters: {
            tenantId: await resolveTenantId(repository, baseId),
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
    const generated = await sdkRuntime.runtime.chatProvider.generate({
      messages: buildSdkChatMessages(request.message, citations),
      metadata: {
        knowledgeBaseIds: targetBaseIds,
        citationCount: citations.length
      }
    });

    return createChatResponse(request, generated.text, citations);
  } catch (error) {
    throw new KnowledgeServiceError('knowledge_chat_failed', getErrorMessage(error));
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

async function resolveTenantId(repository: KnowledgeRepository, baseId: string): Promise<string> {
  const [document] = await repository.listDocumentsForBase(baseId);
  return document?.workspaceId ?? 'default';
}

function createChatResponse(
  request: NormalizedKnowledgeChatRequest,
  answer: string,
  citations: KnowledgeChatCitation[]
): KnowledgeChatResponse {
  const now = new Date().toISOString();
  const conversationId = request.conversationId ?? `conv_${randomUUID()}`;
  const traceId = `trace_${randomUUID()}`;

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

function latestUserMessage(messages: KnowledgeChatRequest['messages']): string | undefined {
  const message = [...(messages ?? [])].reverse().find(item => item.role === 'user');
  if (!message) {
    return undefined;
  }
  if (typeof message.content === 'string') {
    return message.content.trim();
  }
  return message.content
    .filter(part => part.type === 'text')
    .map(part => part.text)
    .join('\n')
    .trim();
}

function normalizeKnowledgeBaseIds(value: string[] | string | undefined): string[] | undefined {
  if (Array.isArray(value)) {
    return value;
  }
  return value
    ?.split(',')
    .map(item => item.trim())
    .filter(isPresent);
}

export function isPresent(value: string | undefined): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
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
