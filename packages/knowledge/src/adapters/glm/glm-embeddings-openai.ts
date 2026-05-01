import { createOpenAIEmbeddingsProvider } from '../langchain/embeddings';

export interface GlmEmbeddingProviderOptions {
  apiKey?: string;
  baseUrl?: string;
  model: string;
  dimensions?: number;
  batchSize?: number;
}

export function createGlmEmbeddingProvider(options: GlmEmbeddingProviderOptions) {
  return createOpenAIEmbeddingsProvider({
    providerId: 'glm',
    model: options.model,
    apiKey: options.apiKey,
    baseUrl: options.baseUrl ?? 'https://open.bigmodel.cn/api/paas/v4',
    dimensions: options.dimensions,
    batchSize: options.batchSize
  });
}
