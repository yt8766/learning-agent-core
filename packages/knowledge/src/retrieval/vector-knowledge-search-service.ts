import type {
  Citation,
  KnowledgeChunk,
  KnowledgeSource,
  RetrievalHit,
  RetrievalRequest,
  RetrievalResult
} from '@agent/knowledge';

import type {
  KnowledgeChunkRepository,
  KnowledgeSearchService,
  KnowledgeSourceRepository
} from '../contracts/knowledge-facade';
import type { VectorSearchProvider } from './vector-search-provider';

export class VectorKnowledgeSearchService implements KnowledgeSearchService {
  constructor(
    private readonly provider: VectorSearchProvider,
    private readonly chunkRepository: KnowledgeChunkRepository,
    private readonly sourceRepository: KnowledgeSourceRepository
  ) {}

  async search(request: RetrievalRequest): Promise<RetrievalResult> {
    const topK = request.limit ?? 5;
    let providerHits;
    try {
      providerHits = await this.provider.searchSimilar(request.query, topK);
    } catch {
      return { hits: [], total: 0 };
    }

    if (providerHits.length === 0) {
      return { hits: [], total: 0 };
    }

    const [chunks, sources] = await Promise.all([this.chunkRepository.list(), this.sourceRepository.list()]);
    const chunkMap = new Map(chunks.map(c => [c.id, c]));
    const sourceMap = new Map(sources.map(s => [s.id, s]));

    const hits: RetrievalHit[] = [];
    for (const providerHit of providerHits) {
      const chunk = chunkMap.get(providerHit.chunkId);
      if (!chunk) {
        continue;
      }
      const source = sourceMap.get(chunk.sourceId);
      if (!source) {
        continue;
      }
      if (request.allowedSourceTypes && !request.allowedSourceTypes.includes(source.sourceType)) {
        continue;
      }
      hits.push(toRetrievalHit(chunk, source, providerHit.score));
    }

    return { hits, total: hits.length };
  }
}

function toRetrievalHit(chunk: KnowledgeChunk, source: KnowledgeSource, score: number): RetrievalHit {
  const citation: Citation = {
    sourceId: source.id,
    chunkId: chunk.id,
    title: source.title,
    uri: source.uri,
    quote: chunk.content,
    sourceType: source.sourceType,
    trustClass: source.trustClass
  };

  return {
    chunkId: chunk.id,
    documentId: chunk.documentId,
    sourceId: source.id,
    title: source.title,
    uri: source.uri,
    sourceType: source.sourceType,
    trustClass: source.trustClass,
    content: chunk.content,
    score,
    citation
  };
}
