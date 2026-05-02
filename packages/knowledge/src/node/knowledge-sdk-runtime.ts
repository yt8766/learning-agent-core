import {
  createOpenAICompatibleChatProvider,
  createOpenAICompatibleEmbeddingProvider,
  SupabasePgVectorStoreAdapter,
  type SupabasePgVectorStoreAdapterOptions
} from '../adapters';
import type { KnowledgeChatProvider, KnowledgeEmbeddingProvider, VectorStore } from '../core';

export type KnowledgeDefaultChatProviderId = 'openai-compatible';
export type KnowledgeDefaultEmbeddingProviderId = 'openai-compatible';
export type KnowledgeDefaultProviderId = KnowledgeDefaultChatProviderId | KnowledgeDefaultEmbeddingProviderId;

export class KnowledgeSdkRuntimeConfigError extends Error {
  readonly cause?: unknown;

  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = 'KnowledgeSdkRuntimeConfigError';
    if (options && 'cause' in options) {
      this.cause = options.cause;
    }
  }
}

interface KnowledgeSdkBaseProviderConfig {
  apiKey?: string;
  model: string;
  baseURL?: string;
  temperature?: number;
  maxTokens?: number;
  dimensions?: number;
  batchSize?: number;
}

export interface KnowledgeSdkChatProviderConfig extends KnowledgeSdkBaseProviderConfig {
  provider: KnowledgeDefaultChatProviderId;
}

export interface KnowledgeSdkEmbeddingProviderConfig extends KnowledgeSdkBaseProviderConfig {
  provider: KnowledgeDefaultEmbeddingProviderId;
}

export interface KnowledgeSdkRuntimeConfig {
  chat: KnowledgeSdkChatProviderConfig;
  embedding: KnowledgeSdkEmbeddingProviderConfig;
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

  try {
    return {
      chatProvider: createChatProvider(config.chat),
      embeddingProvider: createEmbeddingProvider(config.embedding),
      vectorStore: new SupabasePgVectorStoreAdapter(config.vectorStore)
    };
  } catch (error) {
    throw toConfigError(error, 'Failed to create default Knowledge SDK runtime.');
  }
}

function createChatProvider(config: KnowledgeSdkChatProviderConfig): KnowledgeChatProvider {
  if (config.provider !== 'openai-compatible') {
    return assertUnsupportedProvider(config.provider, 'chat');
  }

  return createOpenAICompatibleChatProvider({
    providerId: config.provider,
    model: config.model,
    apiKey: config.apiKey,
    baseUrl: config.baseURL,
    temperature: config.temperature,
    maxTokens: config.maxTokens
  });
}

function createEmbeddingProvider(config: KnowledgeSdkEmbeddingProviderConfig): KnowledgeEmbeddingProvider {
  if (config.provider !== 'openai-compatible') {
    return assertUnsupportedProvider(config.provider, 'embedding');
  }

  return createOpenAICompatibleEmbeddingProvider({
    providerId: config.provider,
    model: config.model,
    apiKey: config.apiKey,
    baseUrl: config.baseURL,
    dimensions: config.dimensions,
    batchSize: config.batchSize
  });
}

function assertUnsupportedProvider(provider: never, capability: string): never {
  throw new KnowledgeSdkRuntimeConfigError(`Unsupported ${capability} provider: ${provider}`);
}

function toConfigError(error: unknown, message: string): KnowledgeSdkRuntimeConfigError {
  if (error instanceof KnowledgeSdkRuntimeConfigError) {
    return error;
  }

  return new KnowledgeSdkRuntimeConfigError(message, { cause: error });
}
