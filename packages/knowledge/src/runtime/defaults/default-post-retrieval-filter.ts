import type {
  PostRetrievalFilter,
  PostRetrievalFilterContext,
  PostRetrievalFilterReason,
  PostRetrievalFilterResult,
  RetrievalSafetyScanner
} from '../stages/post-retrieval-filter';
import type { NormalizedRetrievalRequest } from '../types/retrieval-runtime.types';
import type { RetrievalHit } from '../../contracts';

export interface DefaultPostRetrievalFilterOptions {
  minScore?: number;
  safetyScanner?: RetrievalSafetyScanner;
}

function resolveOptions(
  optionsOrMinScore: number | DefaultPostRetrievalFilterOptions
): DefaultPostRetrievalFilterOptions {
  if (typeof optionsOrMinScore === 'number') {
    return { minScore: optionsOrMinScore };
  }

  return optionsOrMinScore;
}

export class DefaultPostRetrievalFilter implements PostRetrievalFilter {
  private readonly defaultMinScore: number;
  private readonly safetyScanner?: RetrievalSafetyScanner;

  constructor(optionsOrMinScore: number | DefaultPostRetrievalFilterOptions = {}) {
    const options = resolveOptions(optionsOrMinScore);
    this.defaultMinScore = options.minScore ?? 0;
    this.safetyScanner = options.safetyScanner;
  }

  async filter(
    hits: RetrievalHit[],
    _request: NormalizedRetrievalRequest,
    context?: PostRetrievalFilterContext
  ): Promise<PostRetrievalFilterResult> {
    const reasons: Partial<Record<PostRetrievalFilterReason, number>> = {};
    const minScore = context?.minScore ?? this.defaultMinScore;
    const byChunk = new Map<string, RetrievalHit>();
    let maskedCount = 0;

    for (const hit of hits) {
      if (hit.score < minScore) {
        incrementReason(reasons, 'low-score');
        continue;
      }
      if (isLowContextValue(hit.content)) {
        incrementReason(reasons, 'low-context-value');
        continue;
      }
      const safetyResult = await this.applySafetyScanner(hit);
      if (safetyResult.action === 'drop') {
        incrementReason(reasons, 'unsafe-content');
        continue;
      }
      const safeHit = safetyResult.hit;
      if (safetyResult.masked) {
        maskedCount += 1;
      }

      const existing = byChunk.get(safeHit.chunkId);
      if (!existing || safeHit.score > existing.score) {
        if (existing) {
          incrementReason(reasons, 'duplicate-chunk');
        }
        byChunk.set(safeHit.chunkId, safeHit);
      } else {
        incrementReason(reasons, 'duplicate-chunk');
      }
    }

    const filteredHits = Array.from(byChunk.values()).sort((left, right) => right.score - left.score);

    return {
      hits: filteredHits,
      diagnostics: {
        enabled: true,
        beforeCount: hits.length,
        afterCount: filteredHits.length,
        droppedCount: hits.length - filteredHits.length,
        maskedCount,
        reasons
      }
    };
  }

  private async applySafetyScanner(
    hit: RetrievalHit
  ): Promise<{ action: 'keep'; hit: RetrievalHit; masked: boolean } | { action: 'drop' }> {
    if (!this.safetyScanner) {
      return containsUnsafeContent(hit.content) ? { action: 'drop' } : { action: 'keep', hit, masked: false };
    }

    try {
      const result = await this.safetyScanner.scan(hit);
      if (result.action === 'drop') {
        return { action: 'drop' };
      }
      if (result.action === 'mask') {
        return { action: 'keep', hit: maskHitContent(hit, result.maskedContent ?? '[REDACTED]'), masked: true };
      }
      return { action: 'keep', hit, masked: false };
    } catch {
      return containsUnsafeContent(hit.content) ? { action: 'drop' } : { action: 'keep', hit, masked: false };
    }
  }
}

function incrementReason(
  reasons: Partial<Record<PostRetrievalFilterReason, number>>,
  reason: PostRetrievalFilterReason
) {
  reasons[reason] = (reasons[reason] ?? 0) + 1;
}

function isLowContextValue(content: string): boolean {
  const trimmed = content.trim();
  return /^目录\s*\n/.test(trimmed) || /^table of contents/i.test(trimmed);
}

function containsUnsafeContent(content: string): boolean {
  return /\b(password|api[_-]?key|secret|token)\s*[:=]/i.test(content);
}

function maskHitContent(hit: RetrievalHit, maskedContent: string): RetrievalHit {
  return {
    ...hit,
    content: maskedContent,
    citation: typeof hit.citation.quote === 'string' ? { ...hit.citation, quote: maskedContent } : hit.citation
  };
}
