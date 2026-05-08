export type RuntimeArchiveRecord = {
  sessionId: string;
  reason: string;
  archivedAt: string;
};

export type RuntimeCancellationRecord = {
  runId: string;
  reason: string;
  cancelledAt: string;
};

export type RuntimeRecoveryRecord = {
  runId: string;
  checkpointId?: string;
  recoveredAt: string;
};

export type RuntimeArtifactKind = 'all' | 'schedules' | 'archives' | 'recoveries' | 'cancellations' | string;

export type RuntimeArtifactListing = {
  kind: RuntimeArtifactKind;
  schedules: Record<string, unknown>[];
  archives: RuntimeArchiveRecord[];
  recoveries: RuntimeRecoveryRecord[];
  cancellations: RuntimeCancellationRecord[];
};

export type RuntimeGovernanceRepository = {
  archiveThread(archive: RuntimeArchiveRecord): Promise<void>;
  recordCancellation(cancellation: RuntimeCancellationRecord): Promise<void>;
  recordRecovery(recovery: RuntimeRecoveryRecord): Promise<void>;
  listRuntimeArtifacts(kind: RuntimeArtifactKind): Promise<RuntimeArtifactListing>;
};

export function createInMemoryRuntimeGovernanceRepository(): RuntimeGovernanceRepository {
  const schedules: Record<string, unknown>[] = [];
  const archives: RuntimeArchiveRecord[] = [];
  const recoveries: RuntimeRecoveryRecord[] = [];
  const cancellations: RuntimeCancellationRecord[] = [];

  return {
    async archiveThread(archive) {
      archives.push(archive);
    },
    async recordCancellation(cancellation) {
      cancellations.push(cancellation);
    },
    async recordRecovery(recovery) {
      recoveries.push(recovery);
    },
    async listRuntimeArtifacts(kind) {
      return {
        kind,
        schedules: kind === 'all' || kind === 'schedules' ? schedules : [],
        archives: kind === 'all' || kind === 'archives' ? archives : [],
        recoveries: kind === 'all' || kind === 'recoveries' ? recoveries : [],
        cancellations: kind === 'all' || kind === 'cancellations' ? cancellations : []
      };
    }
  };
}

const defaultRuntimeGovernanceRepository = createInMemoryRuntimeGovernanceRepository();

export function getDefaultRuntimeGovernanceRepository(): RuntimeGovernanceRepository {
  return defaultRuntimeGovernanceRepository;
}
