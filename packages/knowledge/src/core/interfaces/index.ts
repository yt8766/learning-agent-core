import type { JsonObject, KnowledgeTokenUsage, ProviderHealth } from '../types';

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

export type KnowledgeChatMessageRole = 'system' | 'user' | 'assistant' | 'tool';

export interface KnowledgeChatMessage {
  role: KnowledgeChatMessageRole;
  content: string;
  name?: string;
  metadata?: JsonObject;
}

export interface KnowledgeChatGenerateInput {
  messages: KnowledgeChatMessage[];
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
  metadata?: JsonObject;
}

export interface KnowledgeChatGenerateResult {
  text: string;
  model: string;
  providerId: string;
  usage?: KnowledgeTokenUsage;
  metadata?: JsonObject;
}

export type KnowledgeChatStreamEvent =
  | {
      type: 'delta';
      text: string;
      metadata?: JsonObject;
    }
  | {
      type: 'usage';
      usage: KnowledgeTokenUsage;
      metadata?: JsonObject;
    }
  | {
      type: 'done';
      result?: KnowledgeChatGenerateResult;
      metadata?: JsonObject;
    };

export interface KnowledgeChatProvider {
  providerId: string;
  defaultModel: string;
  generate(input: KnowledgeChatGenerateInput): Promise<KnowledgeChatGenerateResult>;
  stream?(input: KnowledgeChatGenerateInput): AsyncIterable<KnowledgeChatStreamEvent>;
  healthCheck?(): Promise<ProviderHealth>;
}

export interface KnowledgeEmbeddingResult extends EmbedTextResult {
  dimensions?: number;
}

export interface KnowledgeEmbeddingBatchResult extends EmbedBatchResult {
  dimensions?: number;
}

export interface KnowledgeEmbeddingProvider {
  providerId: string;
  defaultModel: string;
  dimensions?: number;
  embedText(input: EmbedTextInput): Promise<KnowledgeEmbeddingResult>;
  embedBatch(input: EmbedBatchInput): Promise<KnowledgeEmbeddingBatchResult>;
  healthCheck?(): Promise<ProviderHealth>;
}

export interface KnowledgeRerankItem {
  id: string;
  text: string;
  metadata?: JsonObject;
}

export interface KnowledgeRerankInput {
  query: string;
  items: KnowledgeRerankItem[];
  model?: string;
  topK?: number;
  metadata?: JsonObject;
}

export interface KnowledgeRerankHit extends KnowledgeRerankItem {
  score: number;
  index: number;
}

export interface KnowledgeRerankResult {
  hits: KnowledgeRerankHit[];
  model: string;
  providerId: string;
  usage?: KnowledgeTokenUsage;
}

export interface KnowledgeRerankProvider {
  providerId: string;
  defaultModel: string;
  rerank(input: KnowledgeRerankInput): Promise<KnowledgeRerankResult>;
  healthCheck?(): Promise<ProviderHealth>;
}

export interface KnowledgeJudgeInput {
  question: string;
  answer: string;
  context?: string;
  criteria?: string[];
  model?: string;
  metadata?: JsonObject;
}

export interface KnowledgeJudgeResult {
  score: number;
  passed?: boolean;
  reasoning?: string;
  model: string;
  providerId: string;
  usage?: KnowledgeTokenUsage;
  metadata?: JsonObject;
}

export interface KnowledgeJudgeProvider {
  providerId: string;
  defaultModel: string;
  judge(input: KnowledgeJudgeInput): Promise<KnowledgeJudgeResult>;
  healthCheck?(): Promise<ProviderHealth>;
}
