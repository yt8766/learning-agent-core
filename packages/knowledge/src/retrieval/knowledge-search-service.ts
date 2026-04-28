import type { KnowledgeSource, RetrievalHit, RetrievalRequest, RetrievalResult } from '@agent/knowledge';

import type {
  KnowledgeChunkRepository,
  KnowledgeSearchService,
  KnowledgeSourceRepository
} from '../contracts/knowledge-facade';
import { scoreKnowledgeChunk } from '../shared/knowledge-text-scoring';

export class DefaultKnowledgeSearchService implements KnowledgeSearchService {
  constructor(
    private readonly sourceRepository: KnowledgeSourceRepository,
    private readonly chunkRepository: KnowledgeChunkRepository
  ) {}

  async search(request: RetrievalRequest): Promise<RetrievalResult> {
    const limit = request.limit ?? 5;
    const [sources, chunks] = await Promise.all([this.sourceRepository.list(), this.chunkRepository.list()]);
    const sourceMap = new Map(sources.map(source => [source.id, source]));

    const hits = chunks
      .filter(chunk => chunk.searchable)
      .map(chunk => this.toHit(chunk, request, sourceMap))
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
    sourceMap: Map<string, KnowledgeSource>
  ): RetrievalHit | null {
    const source = sourceMap.get(chunk.sourceId);
    if (!source) {
      return null;
    }
    if (request.allowedSourceTypes && !request.allowedSourceTypes.includes(source.sourceType)) {
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
      title: source.title,
      uri: source.uri,
      sourceType: source.sourceType,
      trustClass: source.trustClass,
      content: chunk.content,
      score,
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
