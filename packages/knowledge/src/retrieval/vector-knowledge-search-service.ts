import type {
  Citation,
  KnowledgeChunk,
  KnowledgeSource,
  RetrievalHit,
  RetrievalRequest,
  RetrievalResult
} from '../index';

import type {
  KnowledgeChunkRepository,
  KnowledgeSearchService,
  KnowledgeSourceRepository
} from '../contracts/knowledge-facade';
import {
  getKnowledgeBaseIdFromMetadata,
  matchesKnowledgeChunkFilters,
  matchesKnowledgeSourceFilters,
  resolveKnowledgeRetrievalFilters
} from './knowledge-retrieval-filters';
import type { VectorSearchHit, VectorSearchProvider } from './vector-search-provider';

export class VectorKnowledgeSearchService implements KnowledgeSearchService {
  constructor(
    private readonly provider: VectorSearchProvider,
    private readonly chunkRepository: KnowledgeChunkRepository,
    private readonly sourceRepository: KnowledgeSourceRepository
  ) {}

  async search(request: RetrievalRequest): Promise<RetrievalResult> {
    const topK = request.limit ?? 5;
    const filters = resolveKnowledgeRetrievalFilters(request);
    const providerTopK = topK * 3;
    const providerHits = await this.provider.searchSimilar(request.query, providerTopK, { filters });

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
      if (!matchesKnowledgeSourceFilters(source, filters)) {
        continue;
      }
      if (!matchesKnowledgeChunkFilters(chunk, filters)) {
        continue;
      }
      hits.push(toRetrievalHit(chunk, source, providerHit.score));
    }

    const limitedHits = hits.slice(0, topK);
    return { hits: limitedHits, total: limitedHits.length };
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
    knowledgeBaseId: getKnowledgeBaseIdFromMetadata(chunk.metadata),
    title: source.title,
    uri: source.uri,
    sourceType: source.sourceType,
    trustClass: source.trustClass,
    content: chunk.content,
    score,
    metadata: chunk.metadata,
    citation
  };
}
