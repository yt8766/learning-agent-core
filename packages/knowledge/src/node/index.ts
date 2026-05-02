import type { EmbeddingProvider, VectorDeleteInput, VectorSearchInput, VectorStore, VectorUpsertInput } from '../core';

export interface KnowledgeRuntimeProviders {
  embeddingProvider?: EmbeddingProvider;
  vectorStore: VectorStore;
}

export interface KnowledgeRuntime extends KnowledgeRuntimeProviders {
  providers: KnowledgeRuntimeProviders;
  embedText(text: string): Promise<number[]>;
  searchVectors(input: VectorSearchInput): ReturnType<VectorStore['search']>;
  upsertVectors(input: VectorUpsertInput): ReturnType<VectorStore['upsert']>;
  deleteVectors(input: VectorDeleteInput): ReturnType<VectorStore['delete']>;
}

export function createKnowledgeRuntime(providers: KnowledgeRuntimeProviders): KnowledgeRuntime {
  return {
    ...providers,
    providers,
    async embedText(text) {
      if (!providers.embeddingProvider) {
        throw new Error('KnowledgeRuntime requires an embeddingProvider to embed text.');
      }
      const result = await providers.embeddingProvider.embed({ text });
      return result.embedding;
    },
    deleteVectors(input) {
      return providers.vectorStore.delete(input);
    },
    searchVectors(input) {
      return providers.vectorStore.search(input);
    },
    upsertVectors(input) {
      return providers.vectorStore.upsert(input);
    }
  };
}

export * from './knowledge-sdk-runtime';

export type {
  EmbedBatchInput,
  EmbedBatchResult,
  EmbeddingProvider,
  EmbedTextInput,
  EmbedTextResult,
  VectorDeleteInput as KnowledgeSdkVectorDeleteInput,
  VectorDeleteResult as KnowledgeSdkVectorDeleteResult,
  VectorRecord as KnowledgeSdkVectorRecord,
  VectorSearchHit as KnowledgeSdkVectorSearchHit,
  VectorSearchInput as KnowledgeSdkVectorSearchInput,
  VectorSearchResult as KnowledgeSdkVectorSearchResult,
  VectorStore as KnowledgeSdkVectorStore,
  VectorUpsertInput as KnowledgeSdkVectorUpsertInput,
  VectorUpsertResult as KnowledgeSdkVectorUpsertResult
} from '../core';
