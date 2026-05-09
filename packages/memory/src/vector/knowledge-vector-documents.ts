import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import {
  KnowledgeVectorDocumentRecordSchema,
  type KnowledgeVectorDocumentRecord,
  type KnowledgeVectorIndexWriter
} from '@agent/knowledge';

export type { KnowledgeVectorDocumentRecord, KnowledgeVectorIndexWriter };

interface KnowledgeChunkSnapshot {
  id: string;
  sourceId: string;
  documentId: string;
  content: string;
  searchable?: boolean;
}

interface KnowledgeSourceSnapshot {
  id: string;
  uri: string;
  title: string;
  sourceType: string;
}

export async function loadKnowledgeVectorDocuments(knowledgeRoot: string): Promise<KnowledgeVectorDocumentRecord[]> {
  const [chunks, sources] = await Promise.all([
    readJsonArray<KnowledgeChunkSnapshot>(join(knowledgeRoot, 'chunks/records.json')),
    readJsonArray<KnowledgeSourceSnapshot>(join(knowledgeRoot, 'sources/records.json'))
  ]);
  const sourceById = new Map(sources.map(item => [item.id, item]));

  return chunks
    .filter(item => item.searchable !== false)
    .map(chunk => toKnowledgeVectorDocumentRecord(chunk, sourceById.get(chunk.sourceId)));
}

function toKnowledgeVectorDocumentRecord(
  chunk: KnowledgeChunkSnapshot,
  source?: KnowledgeSourceSnapshot
): KnowledgeVectorDocumentRecord {
  const candidate = {
    id: chunk.id,
    namespace: 'knowledge' as const,
    sourceId: chunk.sourceId,
    documentId: chunk.documentId,
    chunkId: chunk.id,
    uri: source?.uri ?? chunk.documentId,
    title: source?.title ?? source?.uri ?? chunk.documentId,
    sourceType: source?.sourceType ?? 'repo-docs',
    content: chunk.content,
    searchable: chunk.searchable !== false
  };
  const parsed = KnowledgeVectorDocumentRecordSchema.safeParse(candidate);
  if (parsed.success) {
    return parsed.data;
  }
  const fallbackCandidate = {
    ...candidate,
    sourceType: 'repo-docs'
  };
  return KnowledgeVectorDocumentRecordSchema.parse(fallbackCandidate);
}

function isMissingFileError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';
}

async function readJsonArray<T>(path: string): Promise<T[]> {
  try {
    const raw = await readFile(path, 'utf8');
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch (error) {
    if (isMissingFileError(error)) {
      return [];
    }
    throw error;
  }
}
