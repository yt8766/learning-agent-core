import type { KnowledgeChunk, KnowledgeSource, KnowledgeSourceType, KnowledgeTrustClass } from '@agent/core';

export interface KnowledgeIndexingDocument {
  id: string;
  sourceId: string;
  title: string;
  uri: string;
  content: string;
  sourceType: KnowledgeSourceType;
  trustClass: KnowledgeTrustClass;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}

export interface KnowledgeChunkEnvelope {
  source: KnowledgeSource;
  document: KnowledgeIndexingDocument;
  chunk: KnowledgeChunk;
  metadata: Record<string, unknown>;
}

export interface KnowledgeEmbeddingRecord {
  chunkId: string;
  vector: number[];
  modelId?: string;
  metadata?: Record<string, unknown>;
}

export interface KnowledgeIndexingContext {
  runId: string;
  startedAt: string;
  chunkSize: number;
  chunkOverlap: number;
  batchSize: number;
}

export interface KnowledgeIndexingResult {
  runId: string;
  loadedDocumentCount: number;
  indexedDocumentCount: number;
  skippedDocumentCount: number;
  chunkCount: number;
  embeddedChunkCount: number;
  warningCount: number;
  warnings: string[];
}

export interface KnowledgeIndexingRunOptions {
  loader: import('../loaders/knowledge-document-loader').KnowledgeDocumentLoader;
  chunker?: import('../chunkers/knowledge-document-chunker').KnowledgeDocumentChunker;
  transformers?: import('../transformers/knowledge-document-transformer').KnowledgeDocumentTransformer[];
  embedder: import('../embedders/knowledge-embedder').KnowledgeEmbedder;
  writer: import('../writers/knowledge-index-writer').KnowledgeIndexWriter;
  metadataBuilder?: KnowledgeIndexMetadataBuilder;
  shouldIndex?: KnowledgeShouldIndex;
  chunkSize?: number;
  chunkOverlap?: number;
  batchSize?: number;
  onWarning?: (warning: string, context: KnowledgeIndexingContext) => void | Promise<void>;
}

export type KnowledgeShouldIndex = (
  document: KnowledgeIndexingDocument,
  context: KnowledgeIndexingContext
) => boolean | Promise<boolean>;

export type KnowledgeIndexMetadataBuilder = (params: {
  source: KnowledgeSource;
  document: KnowledgeIndexingDocument;
  chunk: KnowledgeChunk;
  context: KnowledgeIndexingContext;
}) => Record<string, unknown> | Promise<Record<string, unknown>>;
