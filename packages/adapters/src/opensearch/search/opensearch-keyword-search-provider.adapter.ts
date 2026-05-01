import { z } from 'zod';
import type {
  KnowledgeTrustClass,
  ResolvedKnowledgeRetrievalFilters,
  RetrievalHit,
  RetrievalRequest,
  RetrievalResult
} from '@agent/knowledge';
import {
  KnowledgeChunkMetadataSchema,
  matchesKnowledgeHitFilters,
  resolveKnowledgeRetrievalFilters
} from '@agent/knowledge';
import type { KnowledgeSearchService } from '@agent/knowledge';

import { AdapterError } from '../../shared/errors/adapter-error';

export type OpenSearchTermValue = string | number | boolean;
export type OpenSearchKnowledgeFilterClause =
  | { term: Record<string, OpenSearchTermValue> }
  | { terms: Record<string, OpenSearchTermValue[]> };

export interface OpenSearchKeywordSearchClientLike {
  search(params: OpenSearchKeywordSearchParams | OpenSearchKeywordHealthCheckParams): Promise<unknown>;
}

export interface OpenSearchKeywordSearchParams {
  index: string;
  size: number;
  query: {
    bool: {
      must: Array<{
        multi_match: {
          query: string;
          fields: string[];
          type: 'best_fields';
        };
      }>;
      filter?: OpenSearchKnowledgeFilterClause[];
    };
  };
}

export interface OpenSearchKeywordHealthCheckParams {
  index: string;
  size: 0;
  query: {
    match_all: Record<string, never>;
  };
}

export interface OpenSearchKeywordSearchProviderOptions {
  client: OpenSearchKeywordSearchClientLike;
  indexName: string;
  fields?: string[];
}

export type OpenSearchKeywordSearchProviderConfig = OpenSearchKeywordSearchProviderOptions;

const DEFAULT_SEARCH_FIELDS = ['title^2', 'content', 'metadata.sectionTitle^1.5'];
const TRUST_CLASSES: KnowledgeTrustClass[] = ['unverified', 'community', 'curated', 'official', 'internal'];

const SearchHitSourceSchema = z.object({
  chunkId: z.string().optional(),
  documentId: z.string(),
  sourceId: z.string(),
  title: z.string(),
  uri: z.string(),
  sourceType: z.enum([
    'workspace-docs',
    'repo-docs',
    'connector-manifest',
    'catalog-sync',
    'user-upload',
    'web-curated'
  ]),
  trustClass: z.enum(['official', 'curated', 'community', 'unverified', 'internal']),
  content: z.string(),
  metadata: KnowledgeChunkMetadataSchema.optional()
});

const SearchResponseSchema = z.object({
  hits: z.object({
    total: z
      .union([
        z.number(),
        z.object({
          value: z.number()
        })
      ])
      .optional(),
    hits: z.array(
      z.object({
        _id: z.string().optional(),
        _score: z.number().nullable().optional(),
        _source: SearchHitSourceSchema
      })
    )
  })
});

export class OpenSearchKeywordSearchProvider implements KnowledgeSearchService {
  constructor(private readonly options: OpenSearchKeywordSearchProviderOptions) {}

  async healthCheck() {
    const checkedAt = new Date().toISOString();
    const startedAt = Date.now();

    await this.options.client
      .search({
        index: this.options.indexName,
        size: 0,
        query: {
          match_all: {}
        }
      })
      .catch(err => {
        throw new AdapterError(
          'OpenSearchKeywordSearchProvider',
          `Failed to check OpenSearch index health: ${String(err)}`,
          err
        );
      });

    return {
      status: 'healthy' as const,
      checkedAt,
      latencyMs: Date.now() - startedAt,
      message: `OpenSearch index "${this.options.indexName}" is reachable.`
    };
  }

  async search(request: RetrievalRequest): Promise<RetrievalResult> {
    const size = request.limit ?? 5;
    if (size <= 0) {
      return { hits: [], total: 0 };
    }

    const filters = resolveKnowledgeRetrievalFilters(request);
    const rawResult = await this.options.client
      .search({
        index: this.options.indexName,
        size,
        query: {
          bool: {
            must: [
              {
                multi_match: {
                  query: request.query,
                  fields: this.options.fields ?? DEFAULT_SEARCH_FIELDS,
                  type: 'best_fields'
                }
              }
            ],
            filter: buildOpenSearchKnowledgeFilter(filters)
          }
        }
      })
      .catch(err => {
        throw new AdapterError(
          'OpenSearchKeywordSearchProvider',
          `Failed to query OpenSearch index: ${String(err)}`,
          err
        );
      });

    const result = mapOpenSearchResponseToRetrievalResult(rawResult);
    const hits = result.hits.filter(hit => matchesKnowledgeHitFilters(hit, filters));
    return {
      hits,
      total: hits.length
    };
  }
}

export function createOpenSearchKeywordSearchProvider(
  config: OpenSearchKeywordSearchProviderConfig
): OpenSearchKeywordSearchProvider {
  return new OpenSearchKeywordSearchProvider(parseOpenSearchKeywordSearchProviderConfig(config));
}

export function parseOpenSearchKeywordSearchProviderConfig(
  config: OpenSearchKeywordSearchProviderConfig
): OpenSearchKeywordSearchProviderOptions {
  if (typeof config.indexName !== 'string' || config.indexName.trim().length === 0) {
    throw new AdapterError(
      'OpenSearchKeywordSearchProvider',
      'OpenSearch keyword provider config requires a non-empty indexName'
    );
  }

  if (!config.client || typeof config.client.search !== 'function') {
    throw new AdapterError(
      'OpenSearchKeywordSearchProvider',
      'OpenSearch keyword provider config requires client.search'
    );
  }

  return {
    client: config.client,
    indexName: config.indexName,
    fields: config.fields
  };
}

export function buildOpenSearchKnowledgeFilter(
  filters?: ResolvedKnowledgeRetrievalFilters
): OpenSearchKnowledgeFilterClause[] | undefined {
  if (!filters) return undefined;

  const clauses: OpenSearchKnowledgeFilterClause[] = [];
  addTermsClause(clauses, 'sourceId', filters.sourceIds);
  addTermsClause(clauses, 'sourceType', filters.sourceTypes);
  addTermsClause(clauses, 'documentId', filters.documentIds);
  addTermsClause(clauses, 'metadata.docType', filters.docTypes);
  addTermsClause(clauses, 'metadata.status', filters.statuses);

  const trustClasses = resolveTrustClassPushdown(filters);
  addTermsClause(clauses, 'trustClass', trustClasses);

  if (filters.searchableOnly) {
    clauses.push({ term: { searchable: true } });
  }

  return clauses.length > 0 ? clauses : undefined;
}

export function mapOpenSearchResponseToRetrievalResult(rawResult: unknown): RetrievalResult {
  const result = SearchResponseSchema.parse(rawResult);
  const hits = result.hits.hits.map(mapOpenSearchHitToRetrievalHit);
  const total = typeof result.hits.total === 'number' ? result.hits.total : (result.hits.total?.value ?? hits.length);

  return {
    hits,
    total
  };
}

function mapOpenSearchHitToRetrievalHit(
  hit: z.infer<typeof SearchResponseSchema>['hits']['hits'][number]
): RetrievalHit {
  const source = hit._source;
  const chunkId = source.chunkId ?? hit._id;

  if (!chunkId) {
    throw new AdapterError('OpenSearchKeywordSearchProvider', 'OpenSearch hit is missing both _id and _source.chunkId');
  }

  return {
    chunkId,
    documentId: source.documentId,
    sourceId: source.sourceId,
    title: source.title,
    uri: source.uri,
    sourceType: source.sourceType,
    trustClass: source.trustClass,
    content: source.content,
    score: hit._score ?? 0,
    metadata: source.metadata,
    citation: {
      sourceId: source.sourceId,
      chunkId,
      title: source.title,
      uri: source.uri,
      quote: source.content,
      sourceType: source.sourceType,
      trustClass: source.trustClass
    }
  };
}

function addTermsClause(
  clauses: OpenSearchKnowledgeFilterClause[],
  field: string,
  values: readonly OpenSearchTermValue[] | undefined
) {
  if (values && values.length > 0) {
    clauses.push({ terms: { [field]: [...values] } });
  }
}

function resolveTrustClassPushdown(filters: ResolvedKnowledgeRetrievalFilters): KnowledgeTrustClass[] | undefined {
  const explicitClasses = filters.trustClasses;
  const minimumClasses = filters.minTrustClass ? trustClassesAtLeast(filters.minTrustClass) : undefined;

  if (explicitClasses && minimumClasses) {
    return explicitClasses.filter(value => minimumClasses.includes(value));
  }

  return explicitClasses ?? minimumClasses;
}

function trustClassesAtLeast(minimum: KnowledgeTrustClass): KnowledgeTrustClass[] {
  const minimumIndex = TRUST_CLASSES.indexOf(minimum);
  return minimumIndex === -1 ? [] : TRUST_CLASSES.slice(minimumIndex);
}
