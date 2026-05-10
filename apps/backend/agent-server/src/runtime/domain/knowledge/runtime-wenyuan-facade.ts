import { loadSettings } from '@agent/config';
import { dirname } from 'node:path';
import { ChatCheckpointRecord, ChatSessionRecord, TaskRecord } from '@agent/core';
import type {
  EvidenceRecord,
  MemoryEventRecord,
  MemoryEvidenceLinkRecord,
  MemoryRecord,
  MemorySearchRequest,
  MemorySearchResult,
  ResolutionCandidateRecord,
  UserProfileRecord
} from '@agent/memory';

type RuntimeSettings = ReturnType<typeof loadSettings>;

export interface RuntimeWenyuanFacadeContext {
  settings: RuntimeSettings;
  memoryRepository: {
    search(query: string, limit?: number): Promise<MemoryRecord[]>;
    searchStructured?(request: MemorySearchRequest): Promise<MemorySearchResult>;
    list(): Promise<MemoryRecord[]>;
    getById(id: string): Promise<MemoryRecord | undefined>;
    invalidate(id: string, reason: string): Promise<MemoryRecord | undefined>;
    supersede(id: string, replacementId: string, reason: string): Promise<MemoryRecord | undefined>;
    restore(id: string): Promise<MemoryRecord | undefined>;
    retire(id: string, reason: string): Promise<MemoryRecord | undefined>;
    quarantine(id: string, reason: string, evidenceRefs?: string[]): Promise<MemoryRecord | undefined>;
    listEvents?(memoryId?: string): Promise<MemoryEventRecord[]>;
    getHistory?(id: string): Promise<{ memory?: MemoryRecord; events: MemoryEventRecord[] }>;
    recordFeedback?(
      id: string,
      kind: 'retrieved' | 'injected' | 'adopted' | 'dismissed' | 'corrected',
      at?: string
    ): Promise<MemoryRecord | undefined>;
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
  };
  runtimeStateRepository: {
    load(): Promise<{
      governanceAudit?: Array<{
        id: string;
        at: string;
        actor: string;
        action: string;
        scope: string;
        targetId: string;
        outcome: string;
        reason?: string;
      }>;
      crossCheckEvidence?: Array<{
        memoryId: string;
        record: EvidenceRecord;
      }>;
    }>;
  };
  sessionCoordinator: {
    listSessions(): ChatSessionRecord[];
    getCheckpoint(sessionId: string): ChatCheckpointRecord | undefined;
  };
  orchestrator: {
    listTasks(): TaskRecord[];
  };
}

export class RuntimeWenyuanFacade {
  constructor(private readonly getContext: () => RuntimeWenyuanFacadeContext) {}

  getMemoryRepository() {
    return this.ctx().memoryRepository;
  }

  searchMemory(query: string, limit = 10) {
    return this.ctx().memoryRepository.search(query, limit);
  }

  searchMemoryStructured(request: MemorySearchRequest) {
    return this.ctx().memoryRepository.searchStructured?.(request);
  }

  listMemories() {
    return this.ctx().memoryRepository.list();
  }

  getMemory(memoryId: string) {
    return this.ctx().memoryRepository.getById(memoryId);
  }

  invalidateMemory(memoryId: string, reason: string) {
    return this.ctx().memoryRepository.invalidate(memoryId, reason);
  }

  supersedeMemory(memoryId: string, replacementId: string, reason: string) {
    return this.ctx().memoryRepository.supersede(memoryId, replacementId, reason);
  }

  restoreMemory(memoryId: string) {
    return this.ctx().memoryRepository.restore(memoryId);
  }

  retireMemory(memoryId: string, reason: string) {
    return this.ctx().memoryRepository.retire(memoryId, reason);
  }

  quarantineMemory(memoryId: string, reason: string, evidenceRefs?: string[]) {
    return this.ctx().memoryRepository.quarantine(memoryId, reason, evidenceRefs);
  }

  listMemoryEvents(memoryId?: string) {
    return this.ctx().memoryRepository.listEvents?.(memoryId) ?? Promise.resolve([]);
  }

  getMemoryHistory(memoryId: string) {
    return this.ctx().memoryRepository.getHistory?.(memoryId) ?? Promise.resolve({ memory: undefined, events: [] });
  }

  recordMemoryFeedback(
    memoryId: string,
    kind: 'retrieved' | 'injected' | 'adopted' | 'dismissed' | 'corrected',
    at?: string
  ) {
    return this.ctx().memoryRepository.recordFeedback?.(memoryId, kind, at);
  }

  overrideMemory(
    memoryId: string,
    replacement: Partial<MemoryRecord> & Pick<MemoryRecord, 'summary' | 'content'>,
    reason: string,
    actor?: string
  ) {
    return this.ctx().memoryRepository.override?.(memoryId, replacement, reason, actor);
  }

  rollbackMemory(memoryId: string, version: number, actor?: string) {
    return this.ctx().memoryRepository.rollback?.(memoryId, version, actor);
  }

  getProfile(userId: string) {
    return this.ctx().memoryRepository.getProfile?.(userId);
  }

  patchProfile(userId: string, patch: Partial<UserProfileRecord>, actor?: string) {
    return this.ctx().memoryRepository.patchProfile?.(userId, patch, actor);
  }

  listResolutionCandidates() {
    return this.ctx().memoryRepository.listResolutionCandidates?.() ?? Promise.resolve([]);
  }

  resolveResolutionCandidate(id: string, resolution: 'accepted' | 'rejected') {
    return this.ctx().memoryRepository.resolveResolutionCandidate?.(id, resolution);
  }

  listEvidenceLinks(memoryId: string) {
    return this.ctx().memoryRepository.listEvidenceLinks?.(memoryId) ?? Promise.resolve([]);
  }

  listHistory() {
    return this.ctx().sessionCoordinator.listSessions();
  }

  getCheckpoint(sessionId: string) {
    return this.ctx().sessionCoordinator.getCheckpoint(sessionId);
  }

  listTaskTraceEntries() {
    return this.ctx()
      .orchestrator.listTasks()
      .flatMap(task =>
        (task.trace ?? []).map(trace => ({
          taskId: task.id,
          goal: task.goal,
          sessionId: task.sessionId,
          node: trace.node,
          at: trace.at,
          summary: trace.summary,
          data: trace.data
        }))
      );
  }

  async listGovernanceHistory() {
    const snapshot = await this.ctx().runtimeStateRepository.load();
    return snapshot.governanceAudit ?? [];
  }

  async listCrossCheckEvidence(memoryId?: string) {
    const snapshot = await this.ctx().runtimeStateRepository.load();
    const evidence = snapshot.crossCheckEvidence ?? [];
    return memoryId ? evidence.filter(item => item.memoryId === memoryId) : evidence;
  }

  async getOverview() {
    const [memories, governanceHistory] = await Promise.all([this.listMemories(), this.listGovernanceHistory()]);
    const sessions = this.listHistory();
    const checkpoints = sessions
      .map(session => this.getCheckpoint(session.id))
      .filter((item): item is ChatCheckpointRecord => Boolean(item));
    const traceEntries = this.listTaskTraceEntries();

    return {
      store: 'wenyuan' as const,
      rootPath: dirname(this.ctx().settings.tasksStateFilePath),
      memoryCount: memories.length,
      sessionCount: sessions.length,
      checkpointCount: checkpoints.length,
      traceCount: traceEntries.length,
      governanceHistoryCount: governanceHistory.length,
      updatedAt: new Date().toISOString()
    };
  }

  private ctx() {
    return this.getContext();
  }
}
