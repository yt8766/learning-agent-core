import { randomUUID } from 'node:crypto';

import type { KnowledgeChunk } from '@agent/knowledge';

import type { DocumentChunkRecord, KnowledgeDocumentRecord } from '../domain/knowledge-document.types';

interface MapSdkChunkToDocumentChunkInput {
  document: KnowledgeDocumentRecord;
  chunk: KnowledgeChunk;
  now: string;
}

export function mapSdkChunkToDocumentChunk(input: MapSdkChunkToDocumentChunkInput): DocumentChunkRecord {
  return {
    id: input.chunk.id || `chunk_${randomUUID()}`,
    documentId: input.document.id,
    ordinal: input.chunk.chunkIndex,
    content: input.chunk.content,
    tokenCount: countTokens(input.chunk.content),
    embeddingStatus: 'pending',
    vectorIndexStatus: 'pending',
    keywordIndexStatus: 'succeeded',
    createdAt: input.now,
    updatedAt: input.now
  };
}

export function countTokens(content: string): number {
  return content.split(/\s+/).filter(Boolean).length;
}
