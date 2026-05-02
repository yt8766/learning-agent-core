import { z } from 'zod';
import type {
  KnowledgeTrustClass,
  ResolvedKnowledgeRetrievalFilters,
  VectorSearchHit,
  VectorSearchProvider
} from '@agent/knowledge';

import { AdapterError } from '../../shared/errors/adapter-error';
import {
  createChromaClient,
  getOrCreateChromaCollection,
  type ChromaClientLike,
  type ChromaClientOptions
} from '../shared/chroma-collection';

export interface QueryEmbeddingProvider {
  embedQuery(text: string): Promise<number[]>;
}

export type ChromaWhereValue = string | number | boolean | { $in: Array<string | number | boolean> };
export type ChromaKnowledgeFilterWhere =
  | Record<string, ChromaWhereValue>
  | { $and: Array<Record<string, ChromaWhereValue>> };

export interface ChromaSearchCollectionLike {
  query(params: {
    queryEmbeddings: number[][];
    nResults: number;
    where?: ChromaKnowledgeFilterWhere;
  }): Promise<unknown>;
}

export interface ChromaVectorSearchProviderOptions {
  collectionName: string;
  collectionMetadata?: Record<string, unknown>;
  embeddingProvider: QueryEmbeddingProvider;
  client?: ChromaClientLike;
  clientOptions?: ChromaClientOptions;
}

const ChromaQueryResultSchema = z.object({
  ids: z.array(z.array(z.string())),
  distances: z.array(z.array(z.number())).optional()
});

const TRUST_CLASSES: KnowledgeTrustClass[] = ['unverified', 'community', 'curated', 'official', 'internal'];

export class ChromaVectorSearchProvider implements VectorSearchProvider {
  private collectionPromise: Promise<ChromaSearchCollectionLike> | null = null;

  constructor(private readonly options: ChromaVectorSearchProviderOptions) {}

  async healthCheck() {
    await this.getCollection();
    return {
      status: 'healthy' as const,
      message: `Chroma collection "${this.options.collectionName}" is reachable.`
    };
  }

  async searchSimilar(query: string, topK: number, options?: { filters?: ResolvedKnowledgeRetrievalFilters }) {
    if (topK <= 0) return [];

    const [embedding, collection] = await Promise.all([
      this.options.embeddingProvider.embedQuery(query),
      this.getCollection()
    ]);

    const rawResult = await collection
      .query({
        queryEmbeddings: [embedding],
        nResults: topK,
        where: buildChromaKnowledgeFilterWhere(options?.filters)
      })
      .catch(err => {
        throw new AdapterError('ChromaVectorSearchProvider', `Failed to query Chroma collection: ${String(err)}`, err);
      });

    return mapChromaQueryResultToVectorHits(rawResult);
  }

  private getCollection(): Promise<ChromaSearchCollectionLike> {
    if (!this.collectionPromise) {
      this.collectionPromise = this.initCollection().catch(err => {
        this.collectionPromise = null;
        throw err;
      });
    }
    return this.collectionPromise;
  }

  private async initCollection(): Promise<ChromaSearchCollectionLike> {
    const client = this.options.client ?? (await createChromaClient(this.options.clientOptions));
    const collection = await getOrCreateChromaCollection(
      client,
      this.options.collectionName,
      this.options.collectionMetadata
    );

    if (!hasQuery(collection)) {
      throw new AdapterError('ChromaVectorSearchProvider', 'Chroma collection does not expose query()');
    }

    return collection;
  }
}

export function buildChromaKnowledgeFilterWhere(
  filters?: ResolvedKnowledgeRetrievalFilters
): ChromaKnowledgeFilterWhere | undefined {
  if (!filters) return undefined;

  const clauses: Array<Record<string, ChromaWhereValue>> = [];
  addInClause(clauses, 'sourceId', filters.sourceIds);
  addInClause(clauses, 'sourceType', filters.sourceTypes);
  addInClause(clauses, 'documentId', filters.documentIds);
  addInClause(clauses, 'docType', filters.docTypes);
  addInClause(clauses, 'status', filters.statuses);

  const trustClasses = resolveTrustClassPushdown(filters);
  addInClause(clauses, 'trustClass', trustClasses);

  if (filters.searchableOnly) {
    clauses.push({ searchable: true });
  }

  if (clauses.length === 0) return undefined;
  if (clauses.length === 1) return clauses[0];
  return { $and: clauses };
}

function mapChromaQueryResultToVectorHits(rawResult: unknown): VectorSearchHit[] {
  const result = ChromaQueryResultSchema.parse(rawResult);
  const ids = result.ids[0] ?? [];
  const distances = result.distances?.[0] ?? [];

  return ids.map((chunkId, index) => ({
    chunkId,
    score: distanceToSimilarityScore(distances[index])
  }));
}

function distanceToSimilarityScore(distance: number | undefined): number {
  if (distance === undefined) return 0;
  return clampScore(1 - distance);
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(1, Number(score.toFixed(6))));
}

function addInClause(
  clauses: Array<Record<string, ChromaWhereValue>>,
  field: string,
  values: readonly (string | number | boolean)[] | undefined
) {
  if (values && values.length > 0) {
    clauses.push({ [field]: { $in: [...values] } });
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

function hasQuery(collection: unknown): collection is ChromaSearchCollectionLike {
  return (
    typeof collection === 'object' &&
    collection !== null &&
    'query' in collection &&
    typeof (collection as { query?: unknown }).query === 'function'
  );
}
