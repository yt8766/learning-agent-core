import { createOpenAIEmbeddingsProvider, type OpenAIEmbeddingsKnowledgeProviderOptions } from '../langchain/embeddings';

export type OpenAICompatibleEmbeddingProviderOptions = OpenAIEmbeddingsKnowledgeProviderOptions;

export function createOpenAICompatibleEmbeddingProvider(options: OpenAICompatibleEmbeddingProviderOptions) {
  return createOpenAIEmbeddingsProvider(options);
}
