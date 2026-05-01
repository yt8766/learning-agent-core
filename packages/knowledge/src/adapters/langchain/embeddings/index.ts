export class LangChainEmbeddingProvider {}

export function createOpenAIEmbeddingsProvider() {
  return new LangChainEmbeddingProvider();
}
