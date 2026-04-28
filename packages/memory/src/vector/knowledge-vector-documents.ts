import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export interface KnowledgeVectorDocumentRecord {
  id: string;
  namespace: 'knowledge';
  sourceId: string;
  documentId: string;
  chunkId: string;
  uri: string;
  title: string;
  sourceType: string;
  content: string;
  searchable: boolean;
}

export interface KnowledgeVectorIndexWriter {
  upsertKnowledge(record: KnowledgeVectorDocumentRecord): Promise<void>;
}

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
    .map(chunk => {
      const source = sourceById.get(chunk.sourceId);
      return {
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
    });
}

async function readJsonArray<T>(path: string): Promise<T[]> {
  try {
    const raw = await readFile(path, 'utf8');
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}
