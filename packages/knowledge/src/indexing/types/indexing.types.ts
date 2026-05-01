import type { Chunker, Document, KnowledgeChunk, KnowledgeSource, Loader } from '@agent/knowledge';
import type { KnowledgeSourceType, KnowledgeTrustClass } from '@agent/knowledge';
import type { KnowledgeVectorIndexWriter } from '@agent/memory';

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
  sourceCount: number;
  indexedDocumentCount: number;
  skippedDocumentCount: number;
  chunkCount: number;
  embeddedChunkCount: number;
  fulltextChunkCount: number;
  warningCount: number;
  warnings: string[];
}

export interface KnowledgeFulltextIndexWriter {
  upsertKnowledgeChunk(chunk: KnowledgeChunk): Promise<void>;
}

export interface KnowledgeSourceIndexWriter {
  upsertKnowledgeSource(source: KnowledgeSource): Promise<void>;
}

export interface KnowledgeIndexingRunOptions {
  loader: Loader;
  chunker?: Chunker;
  vectorIndex: KnowledgeVectorIndexWriter;
  sourceIndex?: KnowledgeSourceIndexWriter;
  fulltextIndex?: KnowledgeFulltextIndexWriter;
  sourceConfig: KnowledgeSourceConfig;
  chunkSize?: number;
  chunkOverlap?: number;
  batchSize?: number;
  shouldIndex?: (doc: Document) => boolean | Promise<boolean>;
  onWarning?: (warning: string) => void | Promise<void>;
}
