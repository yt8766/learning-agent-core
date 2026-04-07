import { loadSettings } from '@agent/config';
import { ChatCheckpointRecord, ChatSessionRecord, EvidenceRecord, MemoryRecord, TaskRecord } from '@agent/shared';

type RuntimeSettings = ReturnType<typeof loadSettings>;

export interface RuntimeWenyuanFacadeContext {
  settings: RuntimeSettings;
  memoryRepository: {
    search(query: string, limit?: number): Promise<MemoryRecord[]>;
    list(): Promise<MemoryRecord[]>;
    getById(id: string): Promise<MemoryRecord | undefined>;
    invalidate(id: string, reason: string): Promise<MemoryRecord | undefined>;
    supersede(id: string, replacementId: string, reason: string): Promise<MemoryRecord | undefined>;
    restore(id: string): Promise<MemoryRecord | undefined>;
    retire(id: string, reason: string): Promise<MemoryRecord | undefined>;
    quarantine(id: string, reason: string, evidenceRefs?: string[]): Promise<MemoryRecord | undefined>;
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
      rootPath: `${this.ctx().settings.workspaceRoot}/data/runtime`,
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
