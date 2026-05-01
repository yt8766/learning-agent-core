import type {
  EmbedBatchInput,
  EmbedTextInput,
  KnowledgeEmbeddingBatchResult,
  KnowledgeEmbeddingProvider,
  KnowledgeEmbeddingResult
} from '../../../core';
import { KnowledgeProviderError } from '../../../core';
import { toKnowledgeProviderError } from '../../shared';

export interface LangChainEmbeddingsLike {
  embedQuery(text: string): Promise<number[]>;
  embedDocuments(texts: string[]): Promise<number[][]>;
}

export interface LangChainEmbeddingProviderOptions {
  providerId: string;
  defaultModel: string;
  dimensions?: number;
  embeddings: LangChainEmbeddingsLike;
}

export class LangChainEmbeddingProvider implements KnowledgeEmbeddingProvider {
  readonly providerId: string;
  readonly defaultModel: string;
  readonly dimensions: number;
  private readonly expectedDimensions?: number;
  private readonly embeddings: LangChainEmbeddingsLike;

  constructor(options: LangChainEmbeddingProviderOptions) {
    this.providerId = options.providerId;
    this.defaultModel = options.defaultModel;
    this.dimensions = options.dimensions ?? 0;
    this.expectedDimensions = options.dimensions;
    this.embeddings = options.embeddings;
  }

  async embedText(input: EmbedTextInput): Promise<KnowledgeEmbeddingResult> {
    try {
      const embedding = await this.embeddings.embedQuery(input.text);
      this.assertDimensions(embedding);
      return { embedding, model: this.defaultModel, dimensions: embedding.length };
    } catch (error) {
      throw this.toEmbeddingError(error);
    }
  }

  async embedBatch(input: EmbedBatchInput): Promise<KnowledgeEmbeddingBatchResult> {
    try {
      const embeddings = await this.embeddings.embedDocuments(input.texts);
      if (embeddings.length !== input.texts.length) {
        throw toKnowledgeProviderError({
          providerId: this.providerId,
          message: 'Embedding count does not match input text count',
          code: 'knowledge_embedding_count_mismatch',
          details: { expected: input.texts.length, actual: embeddings.length }
        });
      }
      for (const embedding of embeddings) {
        this.assertDimensions(embedding);
      }
      return { embeddings, model: this.defaultModel, dimensions: embeddings[0]?.length ?? this.dimensions };
    } catch (error) {
      throw this.toEmbeddingError(error);
    }
  }

  private assertDimensions(embedding: readonly number[]) {
    if (this.expectedDimensions !== undefined && embedding.length !== this.expectedDimensions) {
      throw toKnowledgeProviderError({
        providerId: this.providerId,
        message: `Embedding dimensions mismatch for provider ${this.providerId}`,
        code: 'knowledge_embedding_dimensions_mismatch',
        details: { expected: this.expectedDimensions, actual: embedding.length }
      });
    }
  }

  private toEmbeddingError(error: unknown) {
    if (error instanceof KnowledgeProviderError) {
      return error;
    }
    return toKnowledgeProviderError({
      providerId: this.providerId,
      message: `Knowledge embedding provider ${this.providerId} failed`,
      cause: error
    });
  }
}
