import {
  HybridRetrievalEngine,
  matchesKnowledgeHitFilters,
  resolveKnowledgeRetrievalFilters,
  type KnowledgeSearchService,
  type KnowledgeRetriever,
  type RetrievalRequest,
  type RetrievalResult
} from '@agent/knowledge';

import type { KnowledgeRepository } from '../repositories/knowledge.repository';
import type { KnowledgeSdkRuntimeProviderValue } from '../runtime/knowledge-sdk-runtime.provider';
import type { HyDeProvider } from './knowledge-hyde.provider';
import {
  KnowledgeDomainKeywordRetriever,
  KnowledgeDomainVectorRetriever,
  type KnowledgeDomainVectorRetrieverStats
} from './knowledge-domain-search-service.retrievers';

interface RetrievalDiagnostics {
  retrievalMode: 'hybrid' | 'keyword-only' | 'vector-only' | 'none';
  fallbackApplied: boolean;
  enabledRetrievers: Array<'keyword' | 'vector'>;
  failedRetrievers: Array<'keyword' | 'vector'>;
  fusionStrategy: 'rrf';
  prefilterApplied: boolean;
  candidateCount: number;
  retrievers?: Array<'keyword' | 'vector'>;
  preHitCount?: number;
  finalHitCount?: number;
}

interface KnowledgeDomainSearchResult extends RetrievalResult {
  diagnostics: RetrievalDiagnostics;
}

type RetrieverHitCounts = Record<'keyword' | 'vector', number>;

export class KnowledgeDomainSearchServiceAdapter implements KnowledgeSearchService {
  constructor(
    private readonly repository: KnowledgeRepository,
    private readonly sdkRuntime?: KnowledgeSdkRuntimeProviderValue,
    private readonly hydeProvider?: HyDeProvider
  ) {}

  async search(request: RetrievalRequest): Promise<KnowledgeDomainSearchResult> {
    const keywordRetriever = new KnowledgeDomainKeywordRetriever(this.repository);

    if (!this.sdkRuntime?.enabled) {
      const keywordResult = await keywordRetriever.retrieve(request);
      return {
        ...keywordResult,
        diagnostics: {
          retrievalMode: keywordResult.hits.length > 0 ? 'keyword-only' : 'none',
          fallbackApplied: false,
          enabledRetrievers: ['keyword'],
          retrievers: ['keyword'],
          failedRetrievers: [],
          fusionStrategy: 'rrf',
          prefilterApplied: hasPrefilter(request),
          candidateCount: keywordResult.hits.length,
          preHitCount: 0,
          finalHitCount: keywordResult.hits.length
        }
      };
    }

    const vectorRetriever = new KnowledgeDomainVectorRetriever(this.repository, this.sdkRuntime, this.hydeProvider);
    const retrieverHitCounts: RetrieverHitCounts = { keyword: 0, vector: 0 };
    const engine = new HybridRetrievalEngine([
      createFilteredCountingRetriever(keywordRetriever, request, retrieverHitCounts),
      createFilteredCountingRetriever(vectorRetriever, request, retrieverHitCounts)
    ]);
    const result = await engine.retrieve(request);
    const vectorStats = vectorRetriever.getLastStats();
    const retrievalMode = resolveDomainRetrievalMode(retrieverHitCounts);

    return {
      hits: result.hits,
      total: result.total,
      diagnostics: {
        retrievalMode,
        fallbackApplied: shouldMarkFallbackApplied({
          diagnostics: {
            retrievalMode,
            failedRetrievers: result.diagnostics.failedRetrievers
          },
          vectorStats
        }),
        enabledRetrievers: result.diagnostics.enabledRetrievers,
        retrievers: result.diagnostics.enabledRetrievers,
        failedRetrievers: result.diagnostics.failedRetrievers,
        fusionStrategy: result.diagnostics.fusionStrategy,
        prefilterApplied: result.diagnostics.prefilterApplied,
        candidateCount: result.diagnostics.candidateCount,
        preHitCount: vectorStats.rawHitCount,
        finalHitCount: result.hits.length
      }
    };
  }
}

function createFilteredCountingRetriever(
  retriever: KnowledgeRetriever,
  request: RetrievalRequest,
  hitCounts: RetrieverHitCounts
): KnowledgeRetriever {
  const filters = resolveKnowledgeRetrievalFilters(request);

  return {
    id: retriever.id,
    async retrieve(retrievalRequest) {
      const result = await retriever.retrieve(retrievalRequest);
      const hits = result.hits.filter(hit => matchesKnowledgeHitFilters(hit, filters));
      hitCounts[retriever.id] = hits.length;

      return {
        ...result,
        hits,
        total: hits.length
      };
    }
  };
}

function resolveDomainRetrievalMode(hitCounts: RetrieverHitCounts): RetrievalDiagnostics['retrievalMode'] {
  const hasKeywordHits = hitCounts.keyword > 0;
  const hasVectorHits = hitCounts.vector > 0;

  if (hasKeywordHits && hasVectorHits) {
    return 'hybrid';
  }
  if (hasKeywordHits) {
    return 'keyword-only';
  }
  if (hasVectorHits) {
    return 'vector-only';
  }
  return 'none';
}

function shouldMarkFallbackApplied(input: {
  diagnostics: {
    retrievalMode: RetrievalDiagnostics['retrievalMode'];
    failedRetrievers: Array<'keyword' | 'vector'>;
  };
  vectorStats: KnowledgeDomainVectorRetrieverStats;
}): boolean {
  if (input.diagnostics.failedRetrievers.includes('vector')) {
    return true;
  }
  if (input.vectorStats.rawHitCount > input.vectorStats.mappedHitCount) {
    return true;
  }
  return input.diagnostics.retrievalMode === 'keyword-only';
}

function hasPrefilter(request: RetrievalRequest): boolean {
  return Boolean(request.filters || request.allowedSourceTypes?.length || request.minTrustClass);
}
