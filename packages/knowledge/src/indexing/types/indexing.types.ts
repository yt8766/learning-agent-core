import type { Chunker, Loader } from '../../contracts/indexing/contracts';
import type { Document } from '../../contracts/indexing/schemas';
import type { KnowledgeVectorIndexWriter } from '../../contracts/indexing/knowledge-vector-writer';
import type {
  KnowledgeChunk,
  KnowledgeSource,
  KnowledgeSourceType,
  KnowledgeTrustClass
} from '../../contracts/types/knowledge-retrieval.types';
import type { KnowledgeRagObserver } from '../../observability';

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
  diagnostics?: KnowledgeIndexingDiagnostics;
}

export type KnowledgeIndexingStageName =
  | 'load'
  | 'filter'
  | 'chunk'
  | 'embed'
  | 'store-vector'
  | 'store-fulltext'
  | 'store-source';

export type KnowledgeIndexingStageStatus = 'succeeded' | 'skipped' | 'failed';

export interface KnowledgeIndexingStageDiagnostic {
  stage: KnowledgeIndexingStageName;
  status: KnowledgeIndexingStageStatus;
  inputCount?: number;
  outputCount?: number;
  warningCount?: number;
  message?: string;
}

export interface KnowledgeIndexingQualityGateDiagnostic {
  name: string;
  stage: KnowledgeIndexingStageName;
  status: 'passed' | 'failed' | 'skipped';
  expectedCount?: number;
  actualCount?: number;
  message?: string;
}

export interface KnowledgeIndexingDiagnostics {
  stages: KnowledgeIndexingStageDiagnostic[];
  qualityGates: KnowledgeIndexingQualityGateDiagnostic[];
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
  observer?: KnowledgeRagObserver;
  traceId?: string;
}
