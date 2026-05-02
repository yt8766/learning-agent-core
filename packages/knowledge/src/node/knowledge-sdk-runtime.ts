import {
  createDeepSeekChatProvider,
  createGlmChatProvider,
  createGlmEmbeddingProvider,
  createMiniMaxChatProvider,
  createMiniMaxEmbeddingProvider,
  createOpenAICompatibleChatProvider,
  createOpenAICompatibleEmbeddingProvider,
  SupabasePgVectorStoreAdapter,
  type SupabasePgVectorStoreAdapterOptions
} from '../adapters';
import type { KnowledgeChatProvider, KnowledgeEmbeddingProvider, VectorStore } from '../core';

export type KnowledgeDefaultProviderId = 'openai-compatible' | 'minimax' | 'glm' | 'deepseek';

export class KnowledgeSdkRuntimeConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'KnowledgeSdkRuntimeConfigError';
  }
}

export interface KnowledgeSdkProviderConfig {
  provider: KnowledgeDefaultProviderId;
  apiKey?: string;
  model: string;
  baseURL?: string;
  temperature?: number;
  maxTokens?: number;
  dimensions?: number;
  batchSize?: number;
}

export interface KnowledgeSdkRuntimeConfig {
  chat: KnowledgeSdkProviderConfig;
  embedding: KnowledgeSdkProviderConfig;
  vectorStore?: SupabasePgVectorStoreAdapterOptions;
}

export interface KnowledgeSdkRuntime {
  chatProvider: KnowledgeChatProvider;
  embeddingProvider: KnowledgeEmbeddingProvider;
  vectorStore: VectorStore;
}

export function createDefaultKnowledgeSdkRuntime(config: KnowledgeSdkRuntimeConfig): KnowledgeSdkRuntime {
  if (!config.vectorStore?.client) {
    throw new KnowledgeSdkRuntimeConfigError('Knowledge SDK runtime requires a vectorStore.client.');
  }

  return {
    chatProvider: createChatProvider(config.chat),
    embeddingProvider: createEmbeddingProvider(config.embedding),
    vectorStore: new SupabasePgVectorStoreAdapter(config.vectorStore)
  };
}

function createChatProvider(config: KnowledgeSdkProviderConfig): KnowledgeChatProvider {
  switch (config.provider) {
    case 'openai-compatible':
      return createOpenAICompatibleChatProvider({
        providerId: config.provider,
        model: config.model,
        apiKey: config.apiKey,
        baseUrl: config.baseURL,
        temperature: config.temperature,
        maxTokens: config.maxTokens
      });
    case 'minimax':
      return createMiniMaxChatProvider(toOpenAIStyleOptions(config));
    case 'glm':
      return createGlmChatProvider(toOpenAIStyleOptions(config));
    case 'deepseek':
      return createDeepSeekChatProvider(toOpenAIStyleOptions(config));
    default:
      return assertUnsupportedProvider(config.provider, 'chat');
  }
}

function createEmbeddingProvider(config: KnowledgeSdkProviderConfig): KnowledgeEmbeddingProvider {
  switch (config.provider) {
    case 'openai-compatible':
      return createOpenAICompatibleEmbeddingProvider({
        providerId: config.provider,
        model: config.model,
        apiKey: config.apiKey,
        baseUrl: config.baseURL,
        dimensions: config.dimensions,
        batchSize: config.batchSize
      });
    case 'minimax':
      return createMiniMaxEmbeddingProvider(toEmbeddingOptions(config));
    case 'glm':
      return createGlmEmbeddingProvider(toEmbeddingOptions(config));
    case 'deepseek':
      throw new KnowledgeSdkRuntimeConfigError('Knowledge SDK runtime does not support deepseek embeddings.');
    default:
      return assertUnsupportedProvider(config.provider, 'embedding');
  }
}

function toOpenAIStyleOptions(config: KnowledgeSdkProviderConfig) {
  return {
    model: config.model,
    apiKey: config.apiKey,
    baseUrl: config.baseURL,
    temperature: config.temperature,
    maxTokens: config.maxTokens
  };
}

function toEmbeddingOptions(config: KnowledgeSdkProviderConfig) {
  return {
    model: config.model,
    apiKey: config.apiKey,
    baseUrl: config.baseURL,
    dimensions: config.dimensions,
    batchSize: config.batchSize
  };
}

function assertUnsupportedProvider(provider: never, capability: string): never {
  throw new KnowledgeSdkRuntimeConfigError(`Unsupported ${capability} provider: ${provider}`);
}
