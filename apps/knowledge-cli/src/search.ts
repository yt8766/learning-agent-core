import type {
  KnowledgeChunk,
  KnowledgeSearchService,
  KnowledgeSource,
  RetrievalHit,
  RetrievalResult
} from '@agent/knowledge';

export class SnapshotSearchService implements KnowledgeSearchService {
  private readonly sourceById: Map<string, KnowledgeSource>;

  constructor(
    private readonly chunks: KnowledgeChunk[],
    sources: KnowledgeSource[]
  ) {
    this.sourceById = new Map(sources.map(source => [source.id, source]));
  }

  async search(request: Parameters<KnowledgeSearchService['search']>[0]): Promise<RetrievalResult> {
    const topK = request.limit ?? 5;
    const hits = this.chunks
      .map(chunk => this.toHit(chunk, scoreChunk(chunk.content, request.query)))
      .filter(isScoredHit)
      .sort((left, right) => right.score - left.score)
      .slice(0, topK);

    return { hits, total: hits.length };
  }

  private toHit(chunk: KnowledgeChunk, score: number): RetrievalHit | null {
    const source = this.sourceById.get(chunk.sourceId);
    if (!source) {
      return null;
    }
    const title = typeof chunk.metadata?.title === 'string' ? chunk.metadata.title : source.title;
    return {
      chunkId: chunk.id,
      documentId: chunk.documentId,
      sourceId: chunk.sourceId,
      title,
      uri: source.uri,
      sourceType: source.sourceType,
      trustClass: source.trustClass,
      content: chunk.content,
      score,
      metadata: chunk.metadata,
      citation: {
        sourceId: chunk.sourceId,
        chunkId: chunk.id,
        title,
        uri: source.uri,
        quote: chunk.content,
        sourceType: source.sourceType,
        trustClass: source.trustClass
      }
    };
  }
}

function isScoredHit(hit: RetrievalHit | null): hit is RetrievalHit {
  return hit !== null && hit.score > 0;
}

function scoreChunk(content: string, query: string): number {
  const terms = tokenize(query);
  if (terms.length === 0) {
    return 0;
  }
  const contentTokens = new Set(tokenize(content));
  const matched = terms.filter(term => contentTokens.has(term));
  const phraseBoost = content.toLowerCase().includes(query.toLowerCase()) ? 0.2 : 0;
  return Math.min(1, matched.length / terms.length + phraseBoost);
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9\u4e00-\u9fa5]+/g)
    .map(token => token.trim())
    .filter(token => token.length > 1);
}
