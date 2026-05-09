import type { KnowledgeChunk, KnowledgeSource, RetrievalHit } from '@agent/knowledge';

export interface KnowledgeCliResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface KnowledgeCliSnapshot {
  version: 1;
  createdAt: string;
  documents: KnowledgeCliSnapshotDocument[];
  sources: KnowledgeSource[];
  chunks: KnowledgeChunk[];
}

export interface KnowledgeCliSnapshotDocument {
  id: string;
  title: string;
  uri: string;
  contentLength: number;
}

export interface KnowledgeCliTraceEvent {
  timestamp: string;
  stage: 'index' | 'retrieval' | 'answer';
  message: string;
  data?: Record<string, unknown>;
}

export interface KnowledgeCliRetrievalOutput {
  hits: RetrievalHit[];
  total: number;
  contextBundle?: string;
}
