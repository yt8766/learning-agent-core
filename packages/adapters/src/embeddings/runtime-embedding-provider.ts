import { OpenAIEmbeddings } from '@langchain/openai';

import { normalizeEmbeddingBaseUrl } from '../providers/base-url';

export interface OpenAIEmbeddingModelOptions {
  model: string;
  apiKey?: string;
  baseUrl?: string;
  dimensions?: number;
  batchSize?: number;
}

export interface EmbeddingProvider {
  embedQuery(text: string): Promise<number[]>;
  embedDocuments(texts: string[]): Promise<number[][]>;
}

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

function shouldSuppressDimensions(baseUrl?: string) {
  const normalizedBaseUrl = normalizeEmbeddingBaseUrl(baseUrl ?? '')
    .toLowerCase()
    .replace(/\/$/, '');
  return normalizedBaseUrl.includes('open.bigmodel.cn/api/coding/paas/v4');
}

export function createOpenAIEmbeddingModel(options: OpenAIEmbeddingModelOptions): EmbeddingProvider {
  return new OpenAIEmbeddings({
    model: options.model,
    dimensions: options.dimensions && !shouldSuppressDimensions(options.baseUrl) ? options.dimensions : undefined,
    apiKey: options.apiKey,
    batchSize: Math.max(1, options.batchSize ?? 16),
    encodingFormat: 'float',
    configuration: options.baseUrl
      ? {
          baseURL: normalizeEmbeddingBaseUrl(options.baseUrl)
        }
      : undefined
  });
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
