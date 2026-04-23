import type {
  MemoryEventRecord,
  MemoryEvidenceLinkRecord,
  MemoryRecord,
  MemorySearchRequest,
  MemorySearchResult,
  ReflectionRecord,
  ResolutionCandidateRecord,
  UserProfileRecord
} from '@agent/core';
import type { MemoryFeedbackKind } from '../governance/memory-repository-governance';

export interface MemoryRepository {
  append(record: MemoryRecord): Promise<void>;
  list(): Promise<MemoryRecord[]>;
  search(query: string, limit: number): Promise<MemoryRecord[]>;
  searchStructured?(request: MemorySearchRequest): Promise<MemorySearchResult>;
  getById(id: string): Promise<MemoryRecord | undefined>;
  quarantine(
    id: string,
    reason: string,
    evidenceRefs?: string[],
    category?: MemoryRecord['quarantineCategory'],
    detail?: string,
    restoreSuggestion?: string
  ): Promise<MemoryRecord | undefined>;
  invalidate(id: string, reason: string): Promise<MemoryRecord | undefined>;
  supersede(id: string, replacementId: string, reason: string): Promise<MemoryRecord | undefined>;
  retire(id: string, reason: string): Promise<MemoryRecord | undefined>;
  restore(id: string): Promise<MemoryRecord | undefined>;
  listEvents?(memoryId?: string): Promise<MemoryEventRecord[]>;
  getHistory?(id: string): Promise<{ memory?: MemoryRecord; events: MemoryEventRecord[] }>;
  recordFeedback?(id: string, kind: MemoryFeedbackKind, at?: string): Promise<MemoryRecord | undefined>;
  override?(
    id: string,
    replacement: Partial<MemoryRecord> & Pick<MemoryRecord, 'summary' | 'content'>,
    reason: string,
    actor?: string
  ): Promise<{ previous?: MemoryRecord; replacement: MemoryRecord } | undefined>;
  rollback?(id: string, version: number, actor?: string): Promise<MemoryRecord | undefined>;
  getProfile?(userId: string): Promise<UserProfileRecord | undefined>;
  patchProfile?(userId: string, patch: Partial<UserProfileRecord>, actor?: string): Promise<UserProfileRecord>;
  listResolutionCandidates?(): Promise<ResolutionCandidateRecord[]>;
  resolveResolutionCandidate?(
    id: string,
    resolution: 'accepted' | 'rejected'
  ): Promise<ResolutionCandidateRecord | undefined>;
  listEvidenceLinks?(memoryId: string): Promise<MemoryEvidenceLinkRecord[]>;
  listReflections?(): Promise<ReflectionRecord[]>;
}
