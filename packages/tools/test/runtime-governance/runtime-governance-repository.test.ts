import { describe, expect, it } from 'vitest';

import {
  createInMemoryRuntimeGovernanceRepository,
  getDefaultRuntimeGovernanceRepository,
  type RuntimeArchiveRecord,
  type RuntimeCancellationRecord,
  type RuntimeRecoveryRecord
} from '../../src/runtime-governance/runtime-governance-repository';

const archive: RuntimeArchiveRecord = {
  sessionId: 'sess-001',
  reason: 'idle timeout',
  archivedAt: '2026-01-15T00:00:00.000Z'
};

const cancellation: RuntimeCancellationRecord = {
  runId: 'run-001',
  reason: 'user cancelled',
  cancelledAt: '2026-01-16T00:00:00.000Z'
};

const recovery: RuntimeRecoveryRecord = {
  runId: 'run-002',
  checkpointId: 'cp-1',
  recoveredAt: '2026-01-17T00:00:00.000Z'
};

describe('createInMemoryRuntimeGovernanceRepository', () => {
  it('archives a thread and retrieves it via listRuntimeArtifacts', async () => {
    const repo = createInMemoryRuntimeGovernanceRepository();
    await repo.archiveThread(archive);

    const result = await repo.listRuntimeArtifacts('archives');
    expect(result.archives).toHaveLength(1);
    expect(result.archives[0]).toEqual(archive);
  });

  it('records a cancellation and retrieves it', async () => {
    const repo = createInMemoryRuntimeGovernanceRepository();
    await repo.recordCancellation(cancellation);

    const result = await repo.listRuntimeArtifacts('cancellations');
    expect(result.cancellations).toHaveLength(1);
    expect(result.cancellations[0]).toEqual(cancellation);
  });

  it('records a recovery and retrieves it', async () => {
    const repo = createInMemoryRuntimeGovernanceRepository();
    await repo.recordRecovery(recovery);

    const result = await repo.listRuntimeArtifacts('recoveries');
    expect(result.recoveries).toHaveLength(1);
    expect(result.recoveries[0]).toEqual(recovery);
  });

  describe('listRuntimeArtifacts kind filtering', () => {
    it('returns all artifacts when kind is "all"', async () => {
      const repo = createInMemoryRuntimeGovernanceRepository();
      await repo.archiveThread(archive);
      await repo.recordCancellation(cancellation);
      await repo.recordRecovery(recovery);

      const result = await repo.listRuntimeArtifacts('all');
      expect(result.archives).toHaveLength(1);
      expect(result.cancellations).toHaveLength(1);
      expect(result.recoveries).toHaveLength(1);
      expect(result.schedules).toEqual([]);
    });

    it('returns empty arrays for non-matching kinds', async () => {
      const repo = createInMemoryRuntimeGovernanceRepository();
      await repo.archiveThread(archive);

      const result = await repo.listRuntimeArtifacts('cancellations');
      expect(result.archives).toEqual([]);
      expect(result.cancellations).toEqual([]);
      expect(result.recoveries).toEqual([]);
    });

    it('returns schedules when kind is "schedules"', async () => {
      const repo = createInMemoryRuntimeGovernanceRepository();
      const result = await repo.listRuntimeArtifacts('schedules');
      expect(result.schedules).toEqual([]);
    });

    it('returns the kind field in the result', async () => {
      const repo = createInMemoryRuntimeGovernanceRepository();
      const result = await repo.listRuntimeArtifacts('all');
      expect(result.kind).toBe('all');
    });

    it('accepts custom string kind values', async () => {
      const repo = createInMemoryRuntimeGovernanceRepository();
      const result = await repo.listRuntimeArtifacts('custom-kind');
      expect(result.kind).toBe('custom-kind');
      expect(result.schedules).toEqual([]);
      expect(result.archives).toEqual([]);
    });
  });

  it('accumulates multiple records of the same type', async () => {
    const repo = createInMemoryRuntimeGovernanceRepository();
    await repo.archiveThread(archive);
    await repo.archiveThread({ ...archive, sessionId: 'sess-002' });

    const result = await repo.listRuntimeArtifacts('archives');
    expect(result.archives).toHaveLength(2);
  });
});

describe('getDefaultRuntimeGovernanceRepository', () => {
  it('returns a singleton repository instance', () => {
    const repo1 = getDefaultRuntimeGovernanceRepository();
    const repo2 = getDefaultRuntimeGovernanceRepository();
    expect(repo1).toBe(repo2);
  });
});
