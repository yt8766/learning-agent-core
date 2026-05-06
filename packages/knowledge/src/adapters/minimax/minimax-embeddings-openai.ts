import { createOpenAIEmbeddingsProvider } from '../langchain/embeddings';

export interface MiniMaxEmbeddingProviderOptions {
  apiKey?: string;
  baseUrl?: string;
  model: string;
  dimensions?: number;
  batchSize?: number;
}

export function createMiniMaxEmbeddingProvider(options: MiniMaxEmbeddingProviderOptions) {
  return createOpenAIEmbeddingsProvider({
    providerId: 'minimax',
    model: options.model,
    apiKey: options.apiKey,
    baseUrl: options.baseUrl ?? 'https://api.minimaxi.com/v1',
    dimensions: options.dimensions,
    batchSize: options.batchSize
  });
}
