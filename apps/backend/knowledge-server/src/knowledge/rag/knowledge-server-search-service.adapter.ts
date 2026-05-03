import type { KnowledgeSearchService, RetrievalHit, RetrievalRequest, RetrievalResult } from '@agent/knowledge';

import type { DocumentChunkRecord, KnowledgeDocumentRecord } from '../domain/knowledge-document.types';
import type { KnowledgeRepository } from '../repositories/knowledge.repository';

export class KnowledgeServerSearchServiceAdapter implements KnowledgeSearchService {
  constructor(private readonly repository: KnowledgeRepository) {}

  async search(request: RetrievalRequest): Promise<RetrievalResult> {
    const knowledgeBaseIds = request.filters?.knowledgeBaseIds ?? [];
    const documents = (
      await Promise.all(knowledgeBaseIds.map(baseId => this.repository.listDocumentsForBase(baseId)))
    ).flat();
    const hits = (
      await Promise.all(
        documents.filter(isSearchableDocument).map(async document => {
          const chunks = await this.repository.listChunks(document.id);
          return chunks
            .filter(isSearchableChunk)
            .map(chunk => toRetrievalHit(document, chunk, request.query))
            .filter(hit => hit.score > 0)
            .sort((left, right) => right.score - left.score);
        })
      )
    )
      .flat()
      .sort((left, right) => right.score - left.score)
      .slice(0, request.limit ?? 5);

    return { hits, total: hits.length };
  }
}

function toRetrievalHit(document: KnowledgeDocumentRecord, chunk: DocumentChunkRecord, query: string): RetrievalHit {
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
    score: scoreChunk(quote, query),
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
  return matches / queryTerms.length;
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
