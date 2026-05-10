import type { KnowledgeRetriever, RetrievalHit, RetrievalRequest, RetrievalResult } from '@agent/knowledge';

import type { DocumentChunkRecord, KnowledgeDocumentRecord } from '../domain/knowledge-document.types';
import type { KnowledgeRepository } from '../repositories/knowledge.repository';
import type { KnowledgeSdkRuntimeProviderValue } from '../runtime/knowledge-sdk-runtime.provider';
import type { HyDeProvider } from './knowledge-hyde.provider';

interface IndexedChunk {
  document: KnowledgeDocumentRecord;
  chunk: DocumentChunkRecord;
}

export interface KnowledgeDomainVectorRetrieverStats {
  rawHitCount: number;
  mappedHitCount: number;
}

export class KnowledgeDomainKeywordRetriever implements KnowledgeRetriever {
  readonly id = 'keyword' as const;

  constructor(private readonly repository: KnowledgeRepository) {}

  async retrieve(request: RetrievalRequest): Promise<RetrievalResult> {
    const limit = request.limit ?? 5;
    const indexedChunks = await loadSearchableChunks(
      this.repository,
      request.filters?.knowledgeBaseIds ?? [],
      'keyword'
    );
    const hits = indexedChunks
      .map(({ document, chunk }) => toRetrievalHit(document, chunk, request.query))
      .filter(hit => hit.score > 0)
      .sort((left, right) => right.score - left.score)
      .slice(0, limit);

    return {
      hits,
      total: hits.length
    };
  }
}

export class KnowledgeDomainVectorRetriever implements KnowledgeRetriever {
  readonly id = 'vector' as const;

  private lastStats: KnowledgeDomainVectorRetrieverStats = {
    rawHitCount: 0,
    mappedHitCount: 0
  };

  constructor(
    private readonly repository: KnowledgeRepository,
    private readonly sdkRuntime: Extract<KnowledgeSdkRuntimeProviderValue, { enabled: true }>,
    private readonly hydeProvider?: HyDeProvider
  ) {}

  getLastStats(): KnowledgeDomainVectorRetrieverStats {
    return { ...this.lastStats };
  }

  async retrieve(request: RetrievalRequest): Promise<RetrievalResult> {
    const limit = request.limit ?? 5;
    const knowledgeBaseIds = request.filters?.knowledgeBaseIds ?? [];
    if (knowledgeBaseIds.length === 0) {
      this.lastStats = { rawHitCount: 0, mappedHitCount: 0 };
      return { hits: [], total: 0 };
    }

    const indexedChunks = await loadSearchableChunks(this.repository, knowledgeBaseIds, 'vector');
    if (indexedChunks.length === 0) {
      this.lastStats = { rawHitCount: 0, mappedHitCount: 0 };
      return { hits: [], total: 0 };
    }
    const queryForEmbedding = this.hydeProvider
      ? await this.hydeProvider.generateHypotheticalAnswer(request.query)
      : request.query;
    const embedding = await this.sdkRuntime.runtime.embeddingProvider.embedText({ text: queryForEmbedding });
    const vectorResults = await Promise.all(
      knowledgeBaseIds.map(async knowledgeBaseId =>
        this.sdkRuntime.runtime.vectorStore.search({
          embedding: embedding.embedding,
          topK: limit,
          filters: {
            knowledgeBaseId,
            tenantId: resolveTenantId(indexedChunks, knowledgeBaseId),
            query: request.query
          }
        })
      )
    );
    const rawHits = vectorResults.flatMap(result => result.hits);
    const chunkById = new Map(indexedChunks.map(item => [item.chunk.id, item]));
    const mappedHits = rawHits
      .map(hit => {
        const indexedChunk = chunkById.get(hit.id);
        if (!indexedChunk) {
          return undefined;
        }
        return toRetrievalHit(indexedChunk.document, indexedChunk.chunk, request.query, hit.score);
      })
      .filter(isDefined)
      .sort((left, right) => right.score - left.score);
    const hits = mappedHits.slice(0, limit);

    this.lastStats = {
      rawHitCount: rawHits.length,
      mappedHitCount: mappedHits.length
    };

    return {
      hits,
      total: hits.length
    };
  }
}

export async function loadSearchableChunks(
  repository: KnowledgeRepository,
  knowledgeBaseIds: string[],
  retriever: 'keyword' | 'vector' | 'any' = 'any'
): Promise<IndexedChunk[]> {
  const documents = (await Promise.all(knowledgeBaseIds.map(baseId => repository.listDocumentsForBase(baseId)))).flat();

  return (
    await Promise.all(
      documents.filter(isSearchableDocument).map(async document => {
        const chunks = await repository.listChunks(document.id);
        return chunks.filter(chunk => isSearchableChunk(chunk, retriever)).map(chunk => ({ document, chunk }));
      })
    )
  ).flat();
}

export function toRetrievalHit(
  document: KnowledgeDocumentRecord,
  chunk: DocumentChunkRecord,
  query: string,
  score = scoreChunk(chunk.content, query)
): RetrievalHit {
  const quote = chunk.content.trim();
  return {
    chunkId: chunk.id,
    documentId: document.id,
    sourceId: document.id,
    knowledgeBaseId: document.knowledgeBaseId,
    title: document.title,
    uri: document.objectKey,
    sourceType: document.sourceType,
    trustClass: 'internal',
    content: quote,
    score,
    metadata: {
      ...(chunk.metadata ?? {}),
      knowledgeBaseId: document.knowledgeBaseId,
      workspaceId: document.workspaceId,
      filename: document.filename,
      ordinal: chunk.ordinal
    },
    citation: {
      sourceId: document.id,
      chunkId: chunk.id,
      title: document.title,
      uri: document.objectKey,
      quote,
      sourceType: document.sourceType,
      trustClass: 'internal'
    }
  };
}

export function scoreChunk(content: string, query: string): number {
  const queryTerms = tokenize(query);
  if (queryTerms.length === 0) {
    return 0;
  }
  const contentTerms = new Set(tokenize(content));
  const matches = queryTerms.filter(term => contentTerms.has(term)).length;
  const tokenScore = matches / queryTerms.length;
  return Math.max(tokenScore, scoreChineseSubstring(content, query));
}

function scoreChineseSubstring(content: string, query: string): number {
  const terms = toChineseSearchTerms(query);
  if (terms.length === 0) {
    return 0;
  }
  const normalizedContent = content.toLowerCase();
  const matches = terms.filter(term => normalizedContent.includes(term)).length;
  const score = matches / terms.length;
  return matches >= 2 && score >= 0.4 ? score : 0;
}

function isSearchableDocument(document: KnowledgeDocumentRecord): boolean {
  return document.status === 'ready';
}

function isSearchableChunk(chunk: DocumentChunkRecord, retriever: 'keyword' | 'vector' | 'any'): boolean {
  if (chunk.content.trim().length === 0) {
    return false;
  }
  if (retriever === 'keyword') {
    return chunk.keywordIndexStatus === 'succeeded';
  }
  if (retriever === 'vector') {
    return chunk.vectorIndexStatus === 'succeeded';
  }
  return chunk.keywordIndexStatus === 'succeeded' || chunk.vectorIndexStatus === 'succeeded';
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9\u4e00-\u9fa5]+/u)
    .map(term => term.trim())
    .filter(term => term.length > 1);
}

function toChineseSearchTerms(value: string): string[] {
  const compact = value
    .toLowerCase()
    .replace(/[^\u4e00-\u9fa5]+/gu, '')
    .trim();
  if (compact.length < 2) {
    return [];
  }
  if (compact.length === 2) {
    return [compact];
  }
  return Array.from({ length: compact.length - 1 }, (_, index) => compact.slice(index, index + 2));
}

function resolveTenantId(indexedChunks: IndexedChunk[], knowledgeBaseId: string): string | undefined {
  return indexedChunks.find(item => item.document.knowledgeBaseId === knowledgeBaseId)?.document.workspaceId;
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}
