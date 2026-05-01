import type { RetrievalHit } from '@agent/knowledge';

import type { NormalizedRetrievalRequest } from '../types/retrieval-runtime.types';

export type PostRetrievalRankingSignal =
  | 'retrieval-score'
  | 'authority'
  | 'recency'
  | 'context-fit'
  | 'exact-constraint'
  | 'semantic-rerank'
  | 'alignment';

export interface PostRetrievalRankingDiagnostics {
  enabled: boolean;
  strategy: 'deterministic-signals' | 'deterministic-signals+semantic-rerank';
  scoredCount: number;
  signals: PostRetrievalRankingSignal[];
}

export interface PostRetrievalRankResult {
  hits: RetrievalHit[];
  diagnostics: PostRetrievalRankingDiagnostics;
}

export interface PostRetrievalRanker {
  rank(hits: RetrievalHit[], request: NormalizedRetrievalRequest): Promise<PostRetrievalRankResult>;
}

export interface RetrievalRerankInput {
  query: string;
  hits: RetrievalHit[];
}

export interface RetrievalRerankScore {
  chunkId: string;
  alignmentScore: number;
}

export interface RetrievalRerankProvider {
  rerank(input: RetrievalRerankInput): Promise<RetrievalRerankScore[]>;
}
