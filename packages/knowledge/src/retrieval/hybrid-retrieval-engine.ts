import type { RetrievalHit, RetrievalRequest, RetrievalResult } from '@agent/knowledge';

import type { KnowledgeSearchService } from '../contracts/knowledge-facade';
import type { HybridRetrievalDiagnostics, HybridRetrieverId } from '../runtime/types/retrieval-runtime.types';
import type { RetrievalFusionStrategy } from './fusion-strategy';
import { RrfFusionStrategy } from './fusion-strategy';
import { matchesKnowledgeHitFilters, resolveKnowledgeRetrievalFilters } from './knowledge-retrieval-filters';

export interface HybridRetrievalEngineConfig {
  fusionStrategy?: RetrievalFusionStrategy;
}

export interface KnowledgeRetriever {
  readonly id: HybridRetrieverId;
  retrieve(request: RetrievalRequest): Promise<RetrievalResult>;
}

export interface KeywordRetriever extends KnowledgeRetriever {
  readonly id: 'keyword';
}

export interface VectorRetriever extends KnowledgeRetriever {
  readonly id: 'vector';
}

export interface HybridRetrievalResult extends RetrievalResult {
  diagnostics: HybridRetrievalDiagnostics;
}

interface SettledRetrieverResult {
  id: HybridRetrieverId;
  result: PromiseSettledResult<RetrievalResult>;
}

function hasPrefilter(request: RetrievalRequest): boolean {
  return Boolean(request.filters || request.allowedSourceTypes?.length || request.minTrustClass);
}

function resolveRetrievalMode(successfulRetrievers: HybridRetrieverId[]): HybridRetrievalDiagnostics['retrievalMode'] {
  if (successfulRetrievers.includes('keyword') && successfulRetrievers.includes('vector')) {
    return 'hybrid';
  }
  if (successfulRetrievers.includes('keyword')) {
    return 'keyword-only';
  }
  if (successfulRetrievers.includes('vector')) {
    return 'vector-only';
  }
  return 'none';
}

export function createKnowledgeSearchServiceRetriever(
  id: HybridRetrieverId,
  service: KnowledgeSearchService
): KnowledgeRetriever {
  return {
    id,
    retrieve: request => service.search(request)
  };
}

function isKnowledgeRetriever(value: KnowledgeSearchService | KnowledgeRetriever): value is KnowledgeRetriever {
  return 'retrieve' in value && typeof value.retrieve === 'function';
}

function toKnowledgeRetriever(
  id: HybridRetrieverId,
  serviceOrRetriever: KnowledgeSearchService | KnowledgeRetriever
): KnowledgeRetriever {
  return isKnowledgeRetriever(serviceOrRetriever)
    ? serviceOrRetriever
    : createKnowledgeSearchServiceRetriever(id, serviceOrRetriever);
}

export class HybridRetrievalEngine {
  private readonly fusionStrategy: RetrievalFusionStrategy;
  private readonly retrievers: KnowledgeRetriever[];

  constructor(retrievers: readonly KnowledgeRetriever[], config?: HybridRetrievalEngineConfig);
  constructor(
    keywordRetriever: KnowledgeSearchService | KeywordRetriever,
    vectorRetriever: KnowledgeSearchService | VectorRetriever,
    config?: HybridRetrievalEngineConfig
  );
  constructor(
    retrieversOrKeyword: readonly KnowledgeRetriever[] | KnowledgeSearchService | KeywordRetriever,
    configOrVector?: HybridRetrievalEngineConfig | KnowledgeSearchService | VectorRetriever,
    maybeConfig: HybridRetrievalEngineConfig = {}
  ) {
    const config = Array.isArray(retrieversOrKeyword)
      ? ((configOrVector as HybridRetrievalEngineConfig | undefined) ?? {})
      : maybeConfig;
    this.fusionStrategy = config.fusionStrategy ?? new RrfFusionStrategy();
    if (Array.isArray(retrieversOrKeyword)) {
      this.retrievers = [...retrieversOrKeyword];
      return;
    }

    this.retrievers = [
      toKnowledgeRetriever('keyword', retrieversOrKeyword as KnowledgeSearchService | KeywordRetriever),
      toKnowledgeRetriever('vector', configOrVector as KnowledgeSearchService | VectorRetriever)
    ];
  }

  async retrieve(request: RetrievalRequest): Promise<HybridRetrievalResult> {
    const limit = request.limit ?? 5;
    const filters = resolveKnowledgeRetrievalFilters(request);
    const results = await Promise.allSettled(this.retrievers.map(retriever => retriever.retrieve(request)));
    const settledResults: SettledRetrieverResult[] = this.retrievers.map((retriever, index) => ({
      id: retriever.id,
      result: results[index]!
    }));

    const successfulRetrievers: HybridRetrieverId[] = [];
    const failedRetrievers: HybridRetrieverId[] = [];
    const rankLists: RetrievalHit[][] = [];
    let candidateCount = 0;

    for (const settled of settledResults) {
      if (settled.result.status === 'rejected') {
        failedRetrievers.push(settled.id);
        continue;
      }

      successfulRetrievers.push(settled.id);
      const filteredHits = settled.result.value.hits.filter(hit => matchesKnowledgeHitFilters(hit, filters));
      candidateCount += filteredHits.length;
      if (filteredHits.length > 0) {
        rankLists.push(filteredHits);
      }
    }

    const diagnostics: HybridRetrievalDiagnostics = {
      retrievalMode: resolveRetrievalMode(successfulRetrievers),
      enabledRetrievers: this.retrievers.map(retriever => retriever.id),
      failedRetrievers,
      fusionStrategy: this.fusionStrategy.name,
      prefilterApplied: hasPrefilter(request),
      candidateCount
    };

    if (rankLists.length === 0) {
      return { hits: [], total: 0, diagnostics };
    }

    const merged = this.fusionStrategy.fuse(rankLists).slice(0, limit);
    return { hits: merged, total: merged.length, diagnostics };
  }
}
