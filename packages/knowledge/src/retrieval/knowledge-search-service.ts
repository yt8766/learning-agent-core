import type { KnowledgeSource, RetrievalHit, RetrievalRequest, RetrievalResult } from '../index';

import type {
  KnowledgeChunkRepository,
  KnowledgeSearchService,
  KnowledgeSourceRepository
} from '../contracts/knowledge-facade';
import { scoreKnowledgeChunk } from '../shared/knowledge-text-scoring';
import {
  getKnowledgeBaseIdFromMetadata,
  matchesKnowledgeChunkFilters,
  matchesKnowledgeSourceFilters,
  resolveKnowledgeRetrievalFilters,
  type ResolvedKnowledgeRetrievalFilters
} from './knowledge-retrieval-filters';

export class DefaultKnowledgeSearchService implements KnowledgeSearchService {
  constructor(
    private readonly sourceRepository: KnowledgeSourceRepository,
    private readonly chunkRepository: KnowledgeChunkRepository
  ) {}

  async search(request: RetrievalRequest): Promise<RetrievalResult> {
    const limit = request.limit ?? 5;
    const [sources, chunks] = await Promise.all([this.sourceRepository.list(), this.chunkRepository.list()]);
    const filters = resolveKnowledgeRetrievalFilters(request);
    const sourceMap = new Map(sources.map(source => [source.id, source]));

    const hits = chunks
      .map(chunk => this.toHit(chunk, request, filters, sourceMap))
      .filter((hit): hit is RetrievalHit => Boolean(hit))
      .sort((left, right) => right.score - left.score)
      .slice(0, limit);

    return {
      hits,
      total: hits.length
    };
  }

  private toHit(
    chunk: Awaited<ReturnType<KnowledgeChunkRepository['list']>>[number],
    request: RetrievalRequest,
    filters: ResolvedKnowledgeRetrievalFilters,
    sourceMap: Map<string, KnowledgeSource>
  ): RetrievalHit | null {
    const source = sourceMap.get(chunk.sourceId);
    if (!source) {
      return null;
    }
    if (!matchesKnowledgeSourceFilters(source, filters)) {
      return null;
    }
    if (!matchesKnowledgeChunkFilters(chunk, filters)) {
      return null;
    }

    const score = scoreKnowledgeChunk(request.query, chunk.content);
    if (score <= 0) {
      return null;
    }

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
      citation: {
        sourceId: source.id,
        chunkId: chunk.id,
        title: source.title,
        uri: source.uri,
        quote: chunk.content,
        sourceType: source.sourceType,
        trustClass: source.trustClass
      }
    };
  }
}
