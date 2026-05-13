import type { IntelligenceChannel, IntelligenceKnowledgeCandidate, IntelligenceSignal } from '@agent/core';

export interface IntelligenceRunInput {
  id: string;
  workspaceId: string;
  runKind: 'scheduled' | 'manual' | 'forced';
  status: 'running' | 'completed' | 'failed' | 'partial';
  startedAt: string;
  completedAt?: string;
  triggeredBy?: string;
  summary: Record<string, unknown>;
  error?: Record<string, unknown>;
}

export interface IntelligenceQueryInput {
  id: string;
  runId: string;
  channel: IntelligenceChannel;
  direction: string;
  query: string;
  provider: string;
  status: 'completed' | 'failed' | 'parse_failed' | 'skipped';
  startedAt: string;
  completedAt?: string;
  resultCount: number;
  error?: Record<string, unknown>;
}

export interface IntelligenceRawEventInput {
  id: string;
  queryId: string;
  contentHash: string;
  title: string;
  url: string;
  snippet: string;
  publishedAt?: string;
  fetchedAt: string;
  sourceName: string;
  sourceUrl?: string;
  sourceGroup: 'official' | 'authority' | 'community' | 'unknown';
  rawPayload: Record<string, unknown>;
}

export interface IntelligenceSignalInput extends Omit<IntelligenceSignal, 'knowledgeDecision' | 'sourceCount'> {
  workspaceId: string;
  stableTopicKey: string;
  metadata: Record<string, unknown>;
}

export interface IntelligenceSourceInput {
  id: string;
  signalId: string;
  rawEventId?: string;
  sourceName: string;
  sourceUrl?: string;
  url: string;
  sourceGroup: 'official' | 'authority' | 'community' | 'unknown';
  snippet: string;
  publishedAt?: string;
  capturedAt: string;
  metadata: Record<string, unknown>;
}

export interface IntelligenceKnowledgeCandidateInput extends IntelligenceKnowledgeCandidate {
  metadata: Record<string, unknown>;
}

export interface IntelligenceRepository {
  saveRun(input: IntelligenceRunInput): Promise<void>;
  saveQuery(input: IntelligenceQueryInput): Promise<void>;
  saveRawEvent(input: IntelligenceRawEventInput): Promise<void>;
  upsertSignal(input: IntelligenceSignalInput): Promise<void>;
  saveSource(input: IntelligenceSourceInput): Promise<void>;
  saveCandidate(input: IntelligenceKnowledgeCandidateInput): Promise<void>;
  listRecentSignals(input: { limit: number; channel?: IntelligenceChannel }): Promise<IntelligenceSignal[]>;
  listPendingCandidates(input: { limit: number }): Promise<IntelligenceKnowledgeCandidate[]>;
}
