// packages/knowledge/src/retrieval/hybrid-knowledge-search-service.ts
import type { RetrievalRequest, RetrievalResult } from '@agent/knowledge';

import type { KnowledgeSearchService } from '../contracts/knowledge-facade';
import { rrfFusion } from './rrf-fusion';

export interface HybridSearchConfig {
  /** RRF 平滑系数，默认 60 */
  rrfK?: number;
}

export class HybridKnowledgeSearchService implements KnowledgeSearchService {
  constructor(
    private readonly keywordService: KnowledgeSearchService,
    private readonly vectorService: KnowledgeSearchService,
    private readonly config: HybridSearchConfig = {}
  ) {}

  async search(request: RetrievalRequest): Promise<RetrievalResult> {
    const limit = request.limit ?? 5;
    const [keywordResult, vectorResult] = await Promise.allSettled([
      this.keywordService.search(request),
      this.vectorService.search(request)
    ]);

    const keywordHits = keywordResult.status === 'fulfilled' ? keywordResult.value.hits : [];
    const vectorHits = vectorResult.status === 'fulfilled' ? vectorResult.value.hits : [];

    const rankLists = [keywordHits, vectorHits].filter(list => list.length > 0);
    if (rankLists.length === 0) {
      return { hits: [], total: 0 };
    }

    const merged = rrfFusion(rankLists, this.config.rrfK).slice(0, limit);
    return { hits: merged, total: merged.length };
  }
}
