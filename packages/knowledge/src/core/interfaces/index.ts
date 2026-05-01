import type { JsonObject, ProviderHealth } from '../types';

export interface EmbedTextInput {
  text: string;
  metadata?: JsonObject;
}

export interface EmbedTextResult {
  embedding: number[];
  model: string;
  usage?: {
    inputTokens?: number;
  };
}

export interface EmbedBatchInput {
  texts: string[];
  metadata?: JsonObject;
}

export interface EmbedBatchResult {
  embeddings: number[][];
  model: string;
}

export interface EmbeddingProvider {
  embed(input: EmbedTextInput): Promise<EmbedTextResult>;
  embedBatch?(input: EmbedBatchInput): Promise<EmbedBatchResult>;
  healthCheck?(): Promise<ProviderHealth>;
}

export interface VectorRecord {
  id: string;
  embedding: number[];
  content?: string;
  metadata?: JsonObject;
}

export interface VectorUpsertInput {
  records: VectorRecord[];
}

export interface VectorUpsertResult {
  upsertedCount: number;
}

export interface VectorSearchInput {
  embedding: number[];
  topK: number;
  filters?: JsonObject;
}

export interface VectorSearchHit {
  id: string;
  score: number;
  content?: string;
  metadata?: JsonObject;
}

export interface VectorSearchResult {
  hits: VectorSearchHit[];
}

export interface VectorDeleteInput {
  ids?: string[];
  filter?: JsonObject;
}

export interface VectorDeleteResult {
  deletedCount: number;
}

export interface VectorStore {
  upsert(input: VectorUpsertInput): Promise<VectorUpsertResult>;
  search(input: VectorSearchInput): Promise<VectorSearchResult>;
  delete(input: VectorDeleteInput): Promise<VectorDeleteResult>;
  healthCheck?(): Promise<ProviderHealth>;
}
