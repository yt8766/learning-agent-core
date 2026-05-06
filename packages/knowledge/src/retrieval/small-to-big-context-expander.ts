import type { KnowledgeChunk, RetrievalHit } from '../index';

import type { KnowledgeSourceRepository } from '../contracts/knowledge-facade';
import type {
  ContextExpander,
  ContextExpansionContext,
  ContextExpansionResult
} from '../runtime/stages/context-expander';
import type { NormalizedRetrievalRequest } from '../runtime/types/retrieval-runtime.types';
import { matchesKnowledgeChunkFilters, matchesKnowledgeSourceFilters } from './knowledge-retrieval-filters';

interface ChunkLookupRepository {
  getByIds(ids: string[]): Promise<KnowledgeChunk[]>;
}

const DEFAULT_MAX_EXPANDED_HITS = 10;
const PARENT_METADATA_KEYS = ['parentId'] as const;
const NEIGHBOR_METADATA_KEYS = ['prevChunkId', 'nextChunkId'] as const;

export class SmallToBigContextExpander implements ContextExpander {
  constructor(
    private readonly chunkRepository: ChunkLookupRepository,
    private readonly sourceRepository: KnowledgeSourceRepository
  ) {}

  async expand(
    hits: RetrievalHit[],
    _request: NormalizedRetrievalRequest,
    context: ContextExpansionContext
  ): Promise<ContextExpansionResult> {
    const maxExpandedHits = context.policy?.maxExpandedHits ?? DEFAULT_MAX_EXPANDED_HITS;
    const candidateIds = collectCandidateIds(hits, context);
    const candidateChunksById = new Map(
      (await this.chunkRepository.getByIds(candidateIds)).map(chunk => [chunk.id, chunk])
    );
    const resultHits = [...hits];
    const seenChunkIds = new Set(hits.map(hit => hit.chunkId));
    let addedCount = 0;
    let dedupedCount = 0;
    let missingCount = 0;
    let droppedByFilterCount = 0;

    for (const candidateId of candidateIds) {
      const chunk = candidateChunksById.get(candidateId);
      if (!chunk) {
        missingCount += 1;
        continue;
      }

      if (seenChunkIds.has(chunk.id)) {
        dedupedCount += 1;
        continue;
      }

      const source = await this.sourceRepository.getById(chunk.sourceId);
      if (!source) {
        droppedByFilterCount += 1;
        continue;
      }

      if (
        !matchesKnowledgeSourceFilters(source, context.filters) ||
        !matchesKnowledgeChunkFilters(chunk, context.filters)
      ) {
        droppedByFilterCount += 1;
        continue;
      }

      const seedScore = hits.find(hit => hit.documentId === chunk.documentId)?.score ?? hits[0]?.score ?? 0;
      resultHits.push({
        chunkId: chunk.id,
        documentId: chunk.documentId,
        sourceId: source.id,
        title: source.title,
        uri: source.uri,
        sourceType: source.sourceType,
        trustClass: source.trustClass,
        content: chunk.content,
        score: seedScore,
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
      });
      seenChunkIds.add(chunk.id);
      addedCount += 1;

      if (addedCount >= maxExpandedHits) {
        break;
      }
    }

    return {
      hits: resultHits,
      diagnostics: {
        enabled: true,
        seedCount: hits.length,
        candidateCount: candidateIds.length,
        addedCount,
        dedupedCount,
        missingCount,
        droppedByFilterCount,
        maxExpandedHits
      }
    };
  }
}

function collectCandidateIds(hits: RetrievalHit[], context: ContextExpansionContext): string[] {
  const includeParents = context.policy?.includeParents ?? true;
  const includeNeighbors = context.policy?.includeNeighbors ?? true;
  const metadataKeys = [
    ...(includeParents ? PARENT_METADATA_KEYS : []),
    ...(includeNeighbors ? NEIGHBOR_METADATA_KEYS : [])
  ];

  return hits.flatMap(hit =>
    metadataKeys.flatMap(key => {
      const value = hit.metadata?.[key];
      return typeof value === 'string' && value.length > 0 ? [value] : [];
    })
  );
}
