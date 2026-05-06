import { OpenAIEmbeddings } from '@langchain/openai';

import { LangChainEmbeddingProvider } from './langchain-embedding-provider';

export interface OpenAIEmbeddingsKnowledgeProviderOptions {
  providerId: string;
  model: string;
  apiKey?: string;
  baseUrl?: string;
  dimensions?: number;
  batchSize?: number;
}

export function createOpenAIEmbeddingsProvider(
  options: OpenAIEmbeddingsKnowledgeProviderOptions
): LangChainEmbeddingProvider {
  return new LangChainEmbeddingProvider({
    providerId: options.providerId,
    defaultModel: options.model,
    dimensions: options.dimensions,
    embeddings: new OpenAIEmbeddings({
      model: options.model,
      ...(options.apiKey === undefined ? {} : { apiKey: options.apiKey }),
      ...(options.dimensions === undefined ? {} : { dimensions: options.dimensions }),
      batchSize: Math.max(1, options.batchSize ?? 16),
      encodingFormat: 'float',
      ...(options.baseUrl === undefined ? {} : { configuration: { baseURL: options.baseUrl } })
    })
  });
}
