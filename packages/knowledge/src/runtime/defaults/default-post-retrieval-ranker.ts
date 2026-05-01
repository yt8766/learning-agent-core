import type { RetrievalHit } from '@agent/knowledge';

import type {
  PostRetrievalRanker,
  PostRetrievalRankingSignal,
  PostRetrievalRankResult,
  RetrievalRerankProvider
} from '../stages/post-retrieval-ranker';
import type { NormalizedRetrievalRequest } from '../types/retrieval-runtime.types';

const TRUST_SCORE: Record<RetrievalHit['trustClass'], number> = {
  unverified: 0,
  community: 0.25,
  curated: 0.55,
  official: 0.85,
  internal: 1
};

const SIGNALS: PostRetrievalRankingSignal[] = [
  'retrieval-score',
  'authority',
  'recency',
  'context-fit',
  'exact-constraint'
];

const SEMANTIC_RERANK_SIGNALS: PostRetrievalRankingSignal[] = [...SIGNALS, 'semantic-rerank', 'alignment'];

export interface DefaultPostRetrievalRankerOptions {
  now?: Date;
  rerankProvider?: RetrievalRerankProvider;
}

function normalizeScore(score: number): number {
  if (!Number.isFinite(score)) {
    return 0;
  }

  return Math.max(0, Math.min(score, 1));
}

function recencyScore(value: unknown, now: Date): number {
  if (typeof value !== 'string') {
    return 0;
  }

  const time = Date.parse(value);
  if (!Number.isFinite(time)) {
    return 0;
  }

  const ageDays = (now.getTime() - time) / 86_400_000;
  if (ageDays <= 30) {
    return 1;
  }

  if (ageDays <= 180) {
    return 0.7;
  }

  if (ageDays <= 365) {
    return 0.4;
  }

  return 0.1;
}

function contextFitScore(content: string, query: string): number {
  const normalized = content.trim();
  if (normalized.length < 12) {
    return 0;
  }

  let score = 0.35;
  if (/[。；;:：]/.test(normalized)) {
    score += 0.2;
  }

  if (/需要|材料|证明|步骤|流程|限制|例外|可以|不能/.test(normalized)) {
    score += 0.25;
  }

  const queryTerms = query.split(/\s+/).filter(Boolean);
  if (queryTerms.some(term => normalized.includes(term))) {
    score += 0.2;
  }

  return normalizeScore(score);
}

function exactConstraintScore(content: string, query: string): number {
  const constraints = query.match(/\b\d{4}\b|v\d+(?:\.\d+)*/gi) ?? [];
  if (constraints.length === 0) {
    return 0.5;
  }

  const matched = constraints.filter(item => content.includes(item)).length;
  return matched / constraints.length;
}

function finalScore(hit: RetrievalHit, request: NormalizedRetrievalRequest, now: Date): number {
  const retrieval = normalizeScore(hit.score);
  const authority = TRUST_SCORE[hit.trustClass] ?? 0;
  const recency = recencyScore(hit.metadata?.updatedAt, now);
  const fit = contextFitScore(hit.content, request.normalizedQuery);
  const exact = exactConstraintScore(hit.content, request.normalizedQuery);

  return retrieval * 0.35 + fit * 0.42 + authority * 0.15 + recency * 0.06 + exact * 0.02;
}

function resolveOptions(optionsOrNow: Date | DefaultPostRetrievalRankerOptions): DefaultPostRetrievalRankerOptions {
  if (optionsOrNow instanceof Date) {
    return { now: optionsOrNow };
  }

  return optionsOrNow;
}

export class DefaultPostRetrievalRanker implements PostRetrievalRanker {
  private readonly now: Date;
  private readonly rerankProvider?: RetrievalRerankProvider;

  constructor(optionsOrNow: Date | DefaultPostRetrievalRankerOptions = {}) {
    const options = resolveOptions(optionsOrNow);
    this.now = options.now ?? new Date();
    this.rerankProvider = options.rerankProvider;
  }

  async rank(hits: RetrievalHit[], request: NormalizedRetrievalRequest): Promise<PostRetrievalRankResult> {
    const deterministicScores = new Map(hits.map(hit => [hit.chunkId, finalScore(hit, request, this.now)]));
    const ranked = [...hits].sort((left, right) => {
      const diff = (deterministicScores.get(right.chunkId) ?? 0) - (deterministicScores.get(left.chunkId) ?? 0);
      if (diff !== 0) {
        return diff;
      }

      return right.score - left.score;
    });

    if (this.rerankProvider) {
      try {
        const rerankedScores = await this.rerankProvider.rerank({
          query: request.normalizedQuery,
          hits: ranked
        });
        const alignmentScores = new Map(
          rerankedScores.map(item => [item.chunkId, normalizeScore(item.alignmentScore)] as const)
        );
        const semanticallyRanked = [...ranked].sort((left, right) => {
          const leftAlignment = alignmentScores.get(left.chunkId) ?? 0;
          const rightAlignment = alignmentScores.get(right.chunkId) ?? 0;
          const leftScore = leftAlignment * 0.7 + (deterministicScores.get(left.chunkId) ?? 0) * 0.3;
          const rightScore = rightAlignment * 0.7 + (deterministicScores.get(right.chunkId) ?? 0) * 0.3;
          const diff = rightScore - leftScore;
          if (diff !== 0) {
            return diff;
          }

          return right.score - left.score;
        });

        return {
          hits: semanticallyRanked,
          diagnostics: {
            enabled: true,
            strategy: 'deterministic-signals+semantic-rerank',
            scoredCount: hits.length,
            signals: SEMANTIC_RERANK_SIGNALS
          }
        };
      } catch {
        // Reranker providers are optional semantic enhancers; deterministic ranking remains the fallback.
      }
    }

    return {
      hits: ranked,
      diagnostics: {
        enabled: true,
        strategy: 'deterministic-signals',
        scoredCount: hits.length,
        signals: SIGNALS
      }
    };
  }
}
