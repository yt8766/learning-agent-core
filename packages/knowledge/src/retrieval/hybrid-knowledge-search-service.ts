// packages/knowledge/src/retrieval/hybrid-knowledge-search-service.ts
import type { RetrievalRequest } from '../index';

import type { KnowledgeSearchService } from '../contracts/knowledge-facade';
import { RrfFusionStrategy } from './fusion-strategy';
import type { HybridRetrievalResult } from './hybrid-retrieval-engine';
import { HybridRetrievalEngine } from './hybrid-retrieval-engine';

export interface HybridSearchConfig {
  /** RRF 平滑系数，默认 60 */
  rrfK?: number;
}

export class HybridKnowledgeSearchService implements KnowledgeSearchService {
  private readonly engine: HybridRetrievalEngine;

  constructor(
    keywordService: KnowledgeSearchService,
    vectorService: KnowledgeSearchService,
    config: HybridSearchConfig = {}
  ) {
    this.engine = new HybridRetrievalEngine(keywordService, vectorService, {
      fusionStrategy: new RrfFusionStrategy({ k: config.rrfK })
    });
  }

  async search(request: RetrievalRequest): Promise<HybridRetrievalResult> {
    return this.engine.retrieve(request);
  }
}
