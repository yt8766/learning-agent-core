import { createOpenAIEmbeddingModel } from './openai-embedding-model.factory';

export interface EmbeddingRuntimeSettings {
  embeddings: {
    endpoint: string;
    model: string;
    dimensions?: number;
    apiKey?: string;
  };
  zhipuApiKey?: string;
  mcp?: {
    bigmodelApiKey?: string;
  };
}

export function createRuntimeEmbeddingProvider(settings: EmbeddingRuntimeSettings) {
  return createOpenAIEmbeddingModel({
    model: settings.embeddings.model,
    dimensions: settings.embeddings.dimensions,
    baseUrl: settings.embeddings.endpoint,
    apiKey: resolveRuntimeEmbeddingApiKey(settings)
  });
}

export function resolveRuntimeEmbeddingApiKey(settings: EmbeddingRuntimeSettings) {
  return settings.embeddings.apiKey || settings.mcp?.bigmodelApiKey || settings.zhipuApiKey || undefined;
}
