import type { EmbeddingModel, EmbeddingProvider, InteractionKind, KnowledgeStore, TrustClass } from './primitives';

export interface KnowledgeStoreRecord {
  id: string;
  store: KnowledgeStore;
  displayName: string;
  summary: string;
  rootPath?: string;
  status: 'active' | 'degraded' | 'readonly';
  updatedAt: string;
}

export interface KnowledgeSourceRecord {
  id: string;
  store: Extract<KnowledgeStore, 'cangjing'>;
  sourceType: 'workspace-docs' | 'repo-docs' | 'connector-manifest' | 'catalog-sync';
  uri: string;
  title: string;
  trustClass: TrustClass;
  receiptId?: string;
  version?: string;
  lastIngestedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeChunkRecord {
  id: string;
  store: Extract<KnowledgeStore, 'cangjing'>;
  sourceId: string;
  documentId: string;
  chunkIndex: number;
  content: string;
  tokenCount?: number;
  searchable: boolean;
  receiptId?: string;
  version?: string;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeEmbeddingRecord {
  id: string;
  store: Extract<KnowledgeStore, 'cangjing'>;
  sourceId: string;
  documentId: string;
  chunkId: string;
  embeddingProvider: EmbeddingProvider;
  embeddingModel: EmbeddingModel;
  dimensions: number;
  embeddedAt: string;
  receiptId?: string;
  version?: string;
  status: 'ready' | 'failed';
  failureReason?: string;
}

export interface KnowledgeIngestionReceiptRecord {
  id: string;
  store: Extract<KnowledgeStore, 'cangjing'>;
  sourceId: string;
  sourceType: KnowledgeSourceRecord['sourceType'];
  version: string;
  status: 'completed' | 'partial' | 'failed';
  documentCount: number;
  chunkCount: number;
  embeddedChunkCount: number;
  skippedChunkCount?: number;
  failureReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BudgetState {
  stepBudget: number;
  stepsConsumed: number;
  retryBudget: number;
  retriesConsumed: number;
  sourceBudget: number;
  sourcesConsumed: number;
  tokenBudget?: number;
  tokenConsumed?: number;
  costBudgetUsd?: number;
  costConsumedUsd?: number;
  costConsumedCny?: number;
  softBudgetThreshold?: number;
  hardBudgetThreshold?: number;
  budgetInterruptState?: {
    status: 'idle' | 'soft-threshold-triggered' | 'hard-threshold-triggered' | 'resolved';
    interactionKind?: InteractionKind;
    triggeredAt?: string;
    resolvedAt?: string;
    reason?: string;
  };
  fallbackModelId?: string;
  overBudget?: boolean;
}
