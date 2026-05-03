import type { KnowledgeSearchService, RetrievalHit, RetrievalRequest, RetrievalResult } from '@agent/knowledge';

import type { DocumentChunkRecord, KnowledgeDocumentRecord } from '../domain/knowledge-document.types';
import type { KnowledgeRepository } from '../repositories/knowledge.repository';
import type { KnowledgeSdkRuntimeProviderValue } from '../runtime/knowledge-sdk-runtime.provider';

interface RetrievalDiagnostics {
  retrievalMode: 'hybrid' | 'keyword-only' | 'vector-only' | 'none';
  enabledRetrievers: Array<'keyword' | 'vector'>;
  failedRetrievers: Array<'keyword' | 'vector'>;
  fusionStrategy: 'rrf';
  prefilterApplied: boolean;
  candidateCount: number;
  retrievers?: Array<'keyword' | 'vector'>;
  preHitCount?: number;
  finalHitCount?: number;
}

interface KnowledgeServerSearchResult extends RetrievalResult {
  diagnostics: RetrievalDiagnostics;
}

interface IndexedChunk {
  document: KnowledgeDocumentRecord;
  chunk: DocumentChunkRecord;
}

export class KnowledgeServerSearchServiceAdapter implements KnowledgeSearchService {
  constructor(
    private readonly repository: KnowledgeRepository,
    private readonly sdkRuntime?: KnowledgeSdkRuntimeProviderValue
  ) {}

  async search(request: RetrievalRequest): Promise<KnowledgeServerSearchResult> {
    const limit = request.limit ?? 5;
    const knowledgeBaseIds = request.filters?.knowledgeBaseIds ?? [];
    const documents = (
      await Promise.all(knowledgeBaseIds.map(baseId => this.repository.listDocumentsForBase(baseId)))
    ).flat();
    const indexedChunks = await this.loadSearchableChunks(documents);
    const enabledRetrievers: Array<'keyword' | 'vector'> = [];
    const failedRetrievers: Array<'keyword' | 'vector'> = [];

    const vectorHits = await this.searchVector({
      query: request.query,
      limit,
      knowledgeBaseIds,
      indexedChunks,
      failedRetrievers
    });
    if (this.sdkRuntime?.enabled) {
      enabledRetrievers.push('vector');
    }

    if (vectorHits.length > 0) {
      const hits = vectorHits.slice(0, limit);
      return {
        hits,
        total: hits.length,
        diagnostics: createDiagnostics({
          enabledRetrievers,
          failedRetrievers,
          candidateCount: vectorHits.length,
          preHitCount: vectorHits.length,
          finalHitCount: hits.length
        })
      };
    }

    enabledRetrievers.push('keyword');
    const keywordHits = indexedChunks
      .map(({ document, chunk }) => toRetrievalHit(document, chunk, request.query))
      .filter(hit => hit.score > 0)
      .sort((left, right) => right.score - left.score);
    const hits = keywordHits.slice(0, limit);
    const successfulRetrievers: Array<'keyword' | 'vector'> = keywordHits.length > 0 ? ['keyword'] : [];

    return {
      hits,
      total: hits.length,
      diagnostics: createDiagnostics({
        enabledRetrievers: successfulRetrievers,
        attemptedRetrievers: enabledRetrievers,
        failedRetrievers,
        candidateCount: vectorHits.length + keywordHits.length,
        preHitCount: vectorHits.length,
        finalHitCount: hits.length
      })
    };
  }

  private async loadSearchableChunks(documents: KnowledgeDocumentRecord[]): Promise<IndexedChunk[]> {
    return (
      await Promise.all(
        documents.filter(isSearchableDocument).map(async document => {
          const chunks = await this.repository.listChunks(document.id);
          return chunks.filter(isSearchableChunk).map(chunk => ({ document, chunk }));
        })
      )
    ).flat();
  }

  private async searchVector(input: {
    query: string;
    limit: number;
    knowledgeBaseIds: string[];
    indexedChunks: IndexedChunk[];
    failedRetrievers: Array<'keyword' | 'vector'>;
  }): Promise<RetrievalHit[]> {
    if (!this.sdkRuntime?.enabled || input.knowledgeBaseIds.length === 0) {
      return [];
    }

    try {
      const runtime = this.sdkRuntime.runtime;
      const embedding = await runtime.embeddingProvider.embedText({ text: input.query });
      const hits = (
        await Promise.all(
          input.knowledgeBaseIds.map(async knowledgeBaseId =>
            runtime.vectorStore.search({
              embedding: embedding.embedding,
              topK: input.limit,
              filters: {
                knowledgeBaseId,
                tenantId: resolveTenantId(input.indexedChunks, knowledgeBaseId),
                query: input.query
              }
            })
          )
        )
      ).flatMap(result => result.hits);
      const chunkById = new Map(input.indexedChunks.map(item => [item.chunk.id, item]));

      return hits
        .map(hit => {
          const indexedChunk = chunkById.get(hit.id);
          if (!indexedChunk) {
            return undefined;
          }
          return toRetrievalHit(indexedChunk.document, indexedChunk.chunk, input.query, hit.score);
        })
        .filter(isDefined)
        .sort((left, right) => right.score - left.score);
    } catch {
      input.failedRetrievers.push('vector');
      return [];
    }
  }
}

function toRetrievalHit(
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

function scoreChunk(content: string, query: string): number {
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

function isSearchableChunk(chunk: DocumentChunkRecord): boolean {
  return (
    chunk.content.trim().length > 0 &&
    (chunk.keywordIndexStatus === 'succeeded' || chunk.vectorIndexStatus === 'succeeded')
  );
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

function createDiagnostics(input: {
  enabledRetrievers: Array<'keyword' | 'vector'>;
  attemptedRetrievers?: Array<'keyword' | 'vector'>;
  failedRetrievers: Array<'keyword' | 'vector'>;
  candidateCount: number;
  preHitCount: number;
  finalHitCount: number;
}): RetrievalDiagnostics {
  return {
    retrievalMode: resolveRetrievalMode(input.enabledRetrievers, input.failedRetrievers, input.finalHitCount),
    enabledRetrievers: input.enabledRetrievers,
    retrievers: input.attemptedRetrievers ?? input.enabledRetrievers,
    failedRetrievers: input.failedRetrievers,
    fusionStrategy: 'rrf',
    prefilterApplied: false,
    candidateCount: input.candidateCount,
    preHitCount: input.preHitCount,
    finalHitCount: input.finalHitCount
  } as RetrievalDiagnostics;
}

function resolveRetrievalMode(
  enabledRetrievers: Array<'keyword' | 'vector'>,
  failedRetrievers: Array<'keyword' | 'vector'>,
  finalHitCount: number,
  successfulRetrieversInput?: Array<'keyword' | 'vector'>
): RetrievalDiagnostics['retrievalMode'] {
  const successfulRetrievers =
    successfulRetrieversInput ?? enabledRetrievers.filter(retriever => !failedRetrievers.includes(retriever));
  if (finalHitCount === 0) {
    return 'none';
  }
  if (successfulRetrievers.includes('vector') && !successfulRetrievers.includes('keyword')) {
    return 'vector-only';
  }
  if (successfulRetrievers.includes('vector') && successfulRetrievers.includes('keyword')) {
    return 'hybrid';
  }
  return 'keyword-only';
}

function resolveTenantId(indexedChunks: IndexedChunk[], knowledgeBaseId: string): string | undefined {
  return indexedChunks.find(item => item.document.knowledgeBaseId === knowledgeBaseId)?.document.workspaceId;
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}
