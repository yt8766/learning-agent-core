import type { RetrievalHit } from '@agent/knowledge';

import type { RetrievalFusionStrategyName } from '../runtime/types/retrieval-runtime.types';
import { rrfFusion } from './rrf-fusion';

export interface RetrievalFusionStrategy {
  readonly name: RetrievalFusionStrategyName;
  fuse(rankLists: RetrievalHit[][]): RetrievalHit[];
}

export interface RrfFusionStrategyOptions {
  k?: number;
}

export class RrfFusionStrategy implements RetrievalFusionStrategy {
  readonly name = 'rrf' as const;

  constructor(private readonly options: RrfFusionStrategyOptions = {}) {}

  fuse(rankLists: RetrievalHit[][]): RetrievalHit[] {
    return rrfFusion(rankLists, this.options.k);
  }
}
