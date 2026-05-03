import type { Citation, RetrievalRequest } from '../../contracts';
import type { KnowledgeSearchService } from '../../contracts/knowledge-facade';
import type { RetrievalPipelineConfig } from '../../contracts/knowledge-retrieval-runtime';
import { runKnowledgeRetrieval } from '../../runtime/pipeline/run-knowledge-retrieval';
import type { NormalizedRetrievalRequest } from '../../runtime/types/retrieval-runtime.types';
import type { KnowledgePreRetrievalPlan, KnowledgeRagRetrievalResult } from '../schemas';
import type {
  KnowledgeRagEffectiveSearchMode,
  KnowledgeRagRuntimeRetrievalDiagnostics
} from '../schemas/knowledge-rag-result.schema';

export type RagRetrievalRuntimeResult = Omit<KnowledgeRagRetrievalResult, 'diagnostics'> & {
  diagnostics?: KnowledgeRagRuntimeRetrievalDiagnostics;
};

export interface RagRetrievalRuntimeOptions {
  searchService: KnowledgeSearchService;
  pipeline?: RetrievalPipelineConfig;
  includeDiagnostics?: boolean;
  assembleContext?: boolean;
}

export interface RagRetrievalRunOptions {
  pipeline?: RetrievalPipelineConfig;
  includeDiagnostics?: boolean;
  assembleContext?: boolean;
}

export class RagRetrievalRuntime {
  private readonly searchService: KnowledgeSearchService;
  private readonly pipeline?: RetrievalPipelineConfig;
  private readonly includeDiagnostics: boolean;
  private readonly assembleContext: boolean;

  constructor(options: RagRetrievalRuntimeOptions) {
    this.searchService = options.searchService;
    this.pipeline = options.pipeline;
    this.includeDiagnostics = options.includeDiagnostics ?? true;
    this.assembleContext = options.assembleContext ?? true;
  }

  async retrieve(
    plan: KnowledgePreRetrievalPlan,
    options: RagRetrievalRunOptions = {}
  ): Promise<RagRetrievalRuntimeResult> {
    const primaryQuery = getPrimaryQuery(plan);
    const queryVariants = getQueryVariants(plan, primaryQuery);
    const request = buildRetrievalRequest(plan, primaryQuery);

    const result = await runKnowledgeRetrieval({
      request,
      searchService: this.searchService,
      assembleContext: options.assembleContext ?? this.assembleContext,
      includeDiagnostics: options.includeDiagnostics ?? this.includeDiagnostics,
      pipeline: {
        ...(this.pipeline ?? {}),
        ...(options.pipeline ?? {}),
        queryNormalizer: {
          normalize: async (): Promise<NormalizedRetrievalRequest> => ({
            ...request,
            originalQuery: plan.originalQuery,
            normalizedQuery: primaryQuery,
            topK: plan.strategyHints?.topK ?? request.limit ?? 5,
            rewriteApplied: plan.diagnostics.rewriteApplied,
            queryVariants
          })
        }
      }
    });

    return {
      hits: result.hits,
      total: result.total,
      contextBundle: result.contextBundle,
      citations: collectCitations(result.hits),
      diagnostics: result.diagnostics
        ? {
            ...result.diagnostics,
            requestedSearchMode: plan.searchMode,
            effectiveSearchMode: toEffectiveSearchMode(plan.searchMode)
          }
        : undefined
    };
  }
}

function getPrimaryQuery(plan: KnowledgePreRetrievalPlan): string {
  const rewrittenQuery = plan.rewrittenQuery?.trim();
  if (rewrittenQuery) {
    return rewrittenQuery;
  }

  return plan.originalQuery.trim();
}

function getQueryVariants(plan: KnowledgePreRetrievalPlan, primaryQuery: string): string[] {
  const sourceQueries = plan.queryVariants.length > 0 ? plan.queryVariants : [primaryQuery];
  const queries: string[] = [];
  const seen = new Set<string>();

  for (const query of sourceQueries) {
    const normalizedQuery = query.trim();
    if (!normalizedQuery) {
      continue;
    }

    const key = normalizedQuery.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    queries.push(normalizedQuery);
  }

  return queries.length > 0 ? queries : primaryQuery ? [primaryQuery] : [];
}

function buildRetrievalRequest(plan: KnowledgePreRetrievalPlan, primaryQuery: string): RetrievalRequest {
  const knowledgeBaseIds = dedupeNonEmptyStrings(plan.selectedKnowledgeBaseIds);

  return {
    query: primaryQuery,
    ...(plan.strategyHints?.topK ? { limit: plan.strategyHints.topK } : {}),
    ...(knowledgeBaseIds.length > 0 ? { filters: { knowledgeBaseIds } } : {})
  };
}

function toEffectiveSearchMode(searchMode: KnowledgePreRetrievalPlan['searchMode']): KnowledgeRagEffectiveSearchMode {
  switch (searchMode) {
    case 'keyword-only':
      return 'keyword';
    case 'vector-only':
      return 'vector';
    case 'hybrid':
      return 'hybrid';
  }
}

function collectCitations(hits: KnowledgeRagRetrievalResult['hits']): Citation[] {
  return hits.map(hit => hit.citation);
}

function dedupeNonEmptyStrings(values: string[]): string[] {
  const deduped: string[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    const normalizedValue = value.trim();
    if (!normalizedValue || seen.has(normalizedValue)) {
      continue;
    }

    seen.add(normalizedValue);
    deduped.push(normalizedValue);
  }

  return deduped;
}
