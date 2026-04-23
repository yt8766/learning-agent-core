import type { Chunker, Document, Embedder, Loader, VectorStore } from '@agent/core';
import type { KnowledgeSourceType, KnowledgeTrustClass } from '@agent/core';

export interface KnowledgeSourceConfig {
  sourceId: string;
  sourceType: KnowledgeSourceType;
  trustClass: KnowledgeTrustClass;
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
  loader: Loader;
  chunker?: Chunker;
  embedder: Embedder;
  vectorStore: VectorStore;
  sourceConfig: KnowledgeSourceConfig;
  chunkSize?: number;
  chunkOverlap?: number;
  batchSize?: number;
  shouldIndex?: (doc: Document) => boolean | Promise<boolean>;
  onWarning?: (warning: string) => void | Promise<void>;
}
