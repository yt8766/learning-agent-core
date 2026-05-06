import { BadRequestException, Injectable } from '@nestjs/common';

import type { KnowledgeChunkRecord, KnowledgeTraceRecord } from './interfaces/knowledge-records.types';
import {
  KNOWLEDGE_RAG_DEFAULT_CREATED_BY,
  KNOWLEDGE_RAG_DEFAULT_TENANT_ID,
  KNOWLEDGE_RAG_DEFAULT_TOP_K,
  KNOWLEDGE_RAG_NO_EVIDENCE_ANSWER,
  type KnowledgeRagChatInput,
  type KnowledgeRagChatResult,
  type KnowledgeRagCitation,
  type KnowledgeRagGenerator,
  type KnowledgeRagRetriever,
  type KnowledgeRagRetrievalResult
} from './interfaces/knowledge-rag.types';
import type { KnowledgeRepository } from './repositories/knowledge.repository';

const CITATION_TEXT_LIMIT = 240;
const CITATION_QUOTE_LIMIT = 160;
const CONTENT_PREVIEW_LIMIT = 120;
const TRACE_PREVIEW_LIMIT = 240;
const TRACE_CITATION_TEXT_LIMIT = 120;

export interface KnowledgeRagServiceDeps {
  repo: KnowledgeRepository;
  retriever?: KnowledgeRagRetriever;
  generator?: KnowledgeRagGenerator;
  clock?: () => string;
}

@Injectable()
export class KnowledgeRagService {
  private nextId = 1;
  private readonly repo: KnowledgeRepository;
  private readonly retriever: KnowledgeRagRetriever;
  private readonly generator: KnowledgeRagGenerator;
  private readonly clock: () => string;

  constructor(deps: KnowledgeRagServiceDeps) {
    this.repo = deps.repo;
    this.retriever = deps.retriever ?? new DeterministicKnowledgeRagRetriever(this.repo);
    this.generator = deps.generator ?? new DeterministicKnowledgeRagGenerator();
    this.clock = deps.clock ?? (() => new Date().toISOString());
  }

  async answer(input: KnowledgeRagChatInput): Promise<KnowledgeRagChatResult> {
    const message = input.message?.trim();
    if (!message) {
      throw new BadRequestException('knowledge chat message is required');
    }

    const tenantId = input.tenantId ?? KNOWLEDGE_RAG_DEFAULT_TENANT_ID;
    const createdBy = input.createdBy ?? KNOWLEDGE_RAG_DEFAULT_CREATED_BY;
    const conversationId = input.conversationId ?? this.createId('conv');
    const knowledgeBaseId = input.knowledgeBaseId ?? input.knowledgeBaseIds?.[0];
    const knowledgeBaseIds = input.knowledgeBaseIds ?? (knowledgeBaseId ? [knowledgeBaseId] : []);
    const startedAt = Date.now();
    let retrieval: KnowledgeRagRetrievalResult = { matches: [], topK: input.topK ?? KNOWLEDGE_RAG_DEFAULT_TOP_K };
    let answer = '';
    let assistantMessageId: string | undefined;
    let persistedAssistantMessageId: string | undefined;

    try {
      const userMessage = await this.repo.createChatMessage({
        id: this.createId('msg_user'),
        tenantId,
        conversationId,
        role: 'user',
        content: message,
        knowledgeBaseId,
        createdAt: this.clock(),
        updatedAt: this.clock()
      });

      retrieval = await this.retriever.retrieve({
        tenantId,
        knowledgeBaseId,
        message,
        topK: input.topK ?? KNOWLEDGE_RAG_DEFAULT_TOP_K
      });
      answer = (await this.generator.generate({ message, citations: retrieval.matches })).answer;

      const traceId = this.createId('trace');
      assistantMessageId = this.createId('msg_assistant');
      const latencyMs = Date.now() - startedAt;

      await this.repo.createTrace({
        id: traceId,
        tenantId,
        operation: 'rag.chat',
        status: 'succeeded',
        knowledgeBaseIds,
        conversationId,
        messageId: assistantMessageId,
        latencyMs,
        spans: createSucceededSpans(retrieval, answer, latencyMs),
        metadata: createTraceMetadata({ question: message, answer, createdBy, citations: retrieval.matches }),
        createdAt: this.clock(),
        updatedAt: this.clock()
      });

      const assistantMessage = await this.repo.createChatMessage({
        id: assistantMessageId,
        tenantId,
        conversationId,
        role: 'assistant',
        content: answer,
        knowledgeBaseId,
        citations: retrieval.matches,
        metadata: { traceId },
        createdAt: this.clock(),
        updatedAt: this.clock()
      });
      persistedAssistantMessageId = assistantMessage.id;

      return {
        conversationId,
        answer,
        traceId,
        userMessage,
        assistantMessage: { ...assistantMessage, traceId },
        citations: retrieval.matches,
        retrieval
      };
    } catch (error) {
      try {
        await this.persistFailedTrace({
          tenantId,
          knowledgeBaseIds,
          conversationId,
          messageId: persistedAssistantMessageId,
          latencyMs: Date.now() - startedAt,
          message,
          error
        });
      } catch (_traceError) {
        // Failed trace persistence is best-effort; callers must still see the original RAG error.
      }
      throw error;
    }
  }

  private async persistFailedTrace(input: {
    tenantId: string;
    knowledgeBaseIds: string[];
    conversationId: string;
    messageId?: string;
    latencyMs: number;
    message: string;
    error: unknown;
  }) {
    const trace: KnowledgeTraceRecord = {
      id: this.createId('trace'),
      tenantId: input.tenantId,
      operation: 'rag.chat',
      status: 'failed',
      knowledgeBaseIds: input.knowledgeBaseIds,
      conversationId: input.conversationId,
      messageId: input.messageId,
      latencyMs: input.latencyMs,
      spans: [{ name: 'rag.chat', status: 'failed', latencyMs: input.latencyMs }],
      metadata: { questionPreview: truncate(input.message, TRACE_PREVIEW_LIMIT) },
      errorMessage: input.error instanceof Error ? input.error.message : 'knowledge rag chat failed',
      createdAt: this.clock(),
      updatedAt: this.clock()
    };

    await this.repo.createTrace(trace);
  }

  private createId(prefix: string): string {
    const value = this.nextId;
    this.nextId += 1;
    return `${prefix}_${value}`;
  }
}

class DeterministicKnowledgeRagRetriever implements KnowledgeRagRetriever {
  constructor(private readonly repo: KnowledgeRepository) {}

  async retrieve(input: {
    tenantId: string;
    knowledgeBaseId?: string;
    message: string;
    topK: number;
  }): Promise<KnowledgeRagRetrievalResult> {
    const chunks = await this.repo.listChunks({
      tenantId: input.tenantId,
      knowledgeBaseId: input.knowledgeBaseId
    });
    const queryTokens = tokenize(input.message);
    const matches = chunks.items
      .map(chunk => toScoredCitation(chunk, queryTokens))
      .filter((citation): citation is KnowledgeRagCitation => citation !== undefined)
      .sort((left, right) => right.score - left.score || left.chunkId.localeCompare(right.chunkId))
      .slice(0, input.topK)
      .map((citation, index) => ({ ...citation, rank: index + 1 }));

    return { matches, topK: input.topK };
  }
}

class DeterministicKnowledgeRagGenerator implements KnowledgeRagGenerator {
  async generate(input: { message: string; citations: KnowledgeRagCitation[] }): Promise<{ answer: string }> {
    const [bestCitation] = input.citations;
    if (!bestCitation) {
      return { answer: KNOWLEDGE_RAG_NO_EVIDENCE_ANSWER };
    }

    return { answer: `根据当前知识库中最相关的资料：${bestCitation.text}` };
  }
}

function toScoredCitation(
  chunk: KnowledgeChunkRecord,
  queryTokens: readonly string[]
): KnowledgeRagCitation | undefined {
  const chunkTokens = tokenize(chunk.text);
  const overlap = queryTokens.filter(token => chunkTokens.includes(token));
  if (overlap.length === 0) {
    return undefined;
  }

  const score = overlap.length / queryTokens.length;
  return projectCitation({
    id: `cite_${chunk.id}`,
    chunkId: chunk.id,
    documentId: chunk.documentId,
    knowledgeBaseId: chunk.knowledgeBaseId,
    text: chunk.text,
    quote: chunk.text,
    title: typeof chunk.metadata?.title === 'string' ? chunk.metadata.title : chunk.documentId,
    contentPreview: chunk.text.slice(0, 120),
    score,
    rank: 0,
    metadata: chunk.metadata
  });
}

function projectCitation(input: KnowledgeRagCitation): KnowledgeRagCitation {
  return {
    ...input,
    text: truncate(input.text, CITATION_TEXT_LIMIT),
    quote: truncate(input.quote, CITATION_QUOTE_LIMIT),
    contentPreview: truncate(input.contentPreview, CONTENT_PREVIEW_LIMIT),
    metadata: projectCitationMetadata(input.metadata)
  };
}

function projectCitationMetadata(metadata: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!isPlainRecord(metadata)) {
    return undefined;
  }

  const projected: Record<string, unknown> = {};
  if (typeof metadata.title === 'string') {
    projected.title = metadata.title;
  }
  if (typeof metadata.sourceUri === 'string') {
    projected.sourceUri = metadata.sourceUri;
  }
  if (Array.isArray(metadata.tags) && metadata.tags.every(tag => typeof tag === 'string')) {
    projected.tags = metadata.tags;
  }

  return Object.keys(projected).length > 0 ? projected : undefined;
}

function createTraceMetadata(input: {
  question: string;
  answer: string;
  createdBy: string;
  citations: readonly KnowledgeRagCitation[];
}): Record<string, unknown> {
  return {
    questionPreview: truncate(input.question, TRACE_PREVIEW_LIMIT),
    answerPreview: truncate(input.answer, TRACE_PREVIEW_LIMIT),
    createdBy: input.createdBy,
    citationSummaries: input.citations.map(citation => ({
      chunkId: citation.chunkId,
      documentId: citation.documentId,
      knowledgeBaseId: citation.knowledgeBaseId,
      title: citation.title,
      score: citation.score,
      rank: citation.rank,
      textPreview: truncate(citation.text, TRACE_CITATION_TEXT_LIMIT)
    }))
  };
}

function truncate(value: string, limit: number): string {
  return value.length <= limit ? value : value.slice(0, limit);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function tokenize(value: string): string[] {
  const tokens = value
    .toLowerCase()
    .split(/[^\p{L}\p{N}_]+/u)
    .map(token => token.trim())
    .filter(Boolean);

  return [...new Set(tokens)];
}

function createSucceededSpans(retrieval: KnowledgeRagRetrievalResult, answer: string, latencyMs: number) {
  return [
    { name: 'retrieval', status: 'succeeded', hitCount: retrieval.matches.length, topK: retrieval.topK },
    { name: 'generation', status: 'succeeded', answerLength: answer.length },
    { name: 'persist', status: 'succeeded', latencyMs }
  ];
}
