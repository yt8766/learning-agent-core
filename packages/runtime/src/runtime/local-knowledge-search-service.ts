import { loadSettings } from '@agent/config';
import type { VectorIndexRepository } from '@agent/memory';

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

export type RuntimeKnowledgeSearchDiagnostics = Record<string, unknown>;

export interface RuntimeKnowledgeSearchDiagnosticsSnapshot {
  query: string;
  limit: number;
  hitCount: number;
  total: number;
  diagnostics?: RuntimeKnowledgeSearchDiagnostics;
  searchedAt: string;
}

export interface RuntimeKnowledgeSearchService {
  search(query: string, limit?: number): Promise<LocalKnowledgeSearchHit[]>;
  getLastDiagnostics?(): RuntimeKnowledgeSearchDiagnosticsSnapshot | undefined;
}

export class LocalKnowledgeSearchService implements RuntimeKnowledgeSearchService {
  constructor(
    private readonly settings: RuntimeSettings,
    private readonly vectorIndexRepository: VectorIndexRepository
  ) {}

  async search(query: string, limit = 5): Promise<LocalKnowledgeSearchHit[]> {
    if (!query.trim()) {
      return [];
    }
    const hits = await this.vectorIndexRepository.search(query, limit, 'knowledge');
    return hits
      .map(hit => {
        const metadata = hit.metadata ?? {};
        return {
          chunkId: typeof metadata.chunkId === 'string' ? metadata.chunkId : hit.id,
          documentId: typeof metadata.documentId === 'string' ? metadata.documentId : hit.id,
          sourceId: typeof metadata.sourceId === 'string' ? metadata.sourceId : hit.id,
          uri: typeof metadata.uri === 'string' ? metadata.uri : this.settings.knowledgeRoot,
          title: typeof metadata.title === 'string' ? metadata.title : this.settings.knowledgeRoot,
          sourceType: typeof metadata.sourceType === 'string' ? metadata.sourceType : 'repo-docs',
          content: typeof metadata.content === 'string' ? metadata.content : '',
          score: hit.score
        } satisfies LocalKnowledgeSearchHit;
      })
      .filter(item => item.content);
  }
}
