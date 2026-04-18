import {
  createOpenAIEmbeddingModel,
  createRuntimeEmbeddingProvider,
  type EmbeddingProvider,
  type EmbeddingRuntimeSettings,
  type OpenAIEmbeddingModelOptions
} from '@agent/adapters';

export type { EmbeddingProvider, EmbeddingRuntimeSettings };

export interface HttpEmbeddingProviderOptions extends OpenAIEmbeddingModelOptions {
  endpoint: string;
}

export class HttpEmbeddingProvider implements EmbeddingProvider {
  private readonly model: EmbeddingProvider;

  constructor(options: HttpEmbeddingProviderOptions) {
    this.model = createOpenAIEmbeddingModel({
      model: options.model,
      apiKey: options.apiKey,
      baseUrl: options.endpoint,
      dimensions: options.dimensions,
      batchSize: options.batchSize
    });
  }

  async embedQuery(text: string): Promise<number[]> {
    return this.model.embedQuery(text);
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    return this.model.embedDocuments(texts);
  }
}

export function createHttpEmbeddingProvider(settings: EmbeddingRuntimeSettings) {
  return createRuntimeEmbeddingProvider(settings);
}
