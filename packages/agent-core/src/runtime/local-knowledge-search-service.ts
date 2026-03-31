import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { loadSettings } from '@agent/config';

type RuntimeSettings = ReturnType<typeof loadSettings>;

export interface LocalKnowledgeSearchHit {
  chunkId: string;
  documentId: string;
  sourceId: string;
  uri: string;
  title: string;
  sourceType: string;
  content: string;
  score: number;
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

export class LocalKnowledgeSearchService {
  constructor(private readonly settings: RuntimeSettings) {}

  async search(query: string, limit = 5): Promise<LocalKnowledgeSearchHit[]> {
    const [chunks, sources] = await Promise.all([
      this.readJsonArray<KnowledgeChunkSnapshot>(join(this.settings.knowledgeRoot, 'chunks/records.json')),
      this.readJsonArray<KnowledgeSourceSnapshot>(join(this.settings.knowledgeRoot, 'sources/records.json'))
    ]);
    if (!query.trim()) {
      return [];
    }

    const sourceById = new Map(sources.map(item => [item.id, item]));
    return chunks
      .filter(item => item.searchable)
      .map(chunk => {
        const source = sourceById.get(chunk.sourceId);
        return {
          chunkId: chunk.id,
          documentId: chunk.documentId,
          sourceId: chunk.sourceId,
          uri: source?.uri ?? chunk.documentId,
          title: source?.title ?? source?.uri ?? chunk.documentId,
          sourceType: source?.sourceType ?? 'repo-docs',
          content: chunk.content,
          score: lexicalScore(query, chunk.content)
        } satisfies LocalKnowledgeSearchHit;
      })
      .filter(item => item.score > 0)
      .sort((left, right) => right.score - left.score)
      .slice(0, limit);
  }

  private async readJsonArray<T>(path: string): Promise<T[]> {
    try {
      const raw = await readFile(path, 'utf8');
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch {
      return [];
    }
  }
}

function lexicalScore(query: string, text: string) {
  const queryTokens = tokenize(query);
  if (!queryTokens.length) {
    return 0;
  }
  const haystack = tokenize(text);
  if (!haystack.length) {
    return 0;
  }
  const haystackSet = new Set(haystack);
  let score = 0;
  for (const token of queryTokens) {
    if (haystackSet.has(token)) {
      score += token.length > 4 ? 3 : 1;
    }
  }
  return score;
}

function tokenize(text: string) {
  return text
    .toLowerCase()
    .split(/[^a-z0-9\u4e00-\u9fa5]+/g)
    .map(item => item.trim())
    .filter(Boolean);
}
