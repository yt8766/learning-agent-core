export interface EmbeddingProviderInput {
  values: string[];
  modelId?: string;
  taskId?: string;
}

export interface EmbeddingProviderResult {
  vectors: number[][];
  dimensions?: number;
  model?: string;
}

export interface IEmbeddingProvider {
  readonly providerId: string;
  readonly displayName: string;
  isConfigured(): boolean;
  embed(input: EmbeddingProviderInput): Promise<EmbeddingProviderResult>;
}
