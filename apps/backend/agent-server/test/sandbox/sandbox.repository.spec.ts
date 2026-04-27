import { describe, expect, it } from 'vitest';

import { SandboxRepository } from '../../src/sandbox/sandbox.repository';
import type { SandboxRunRecord } from '../../src/sandbox/sandbox.types';

describe('SandboxRepository', () => {
  it('restores sandbox runs in snapshot order without leaking exported state', () => {
    const repository = new SandboxRepository();
    const firstRun = buildRun('sandbox-run-snapshot-1', {
      evidenceIds: ['evidence-1'],
      artifactIds: ['artifact-1'],
      metadata: { nested: { path: 'apps/backend/agent-server' } }
    });
    const secondRun = buildRun('sandbox-run-snapshot-2', {
      status: 'blocked',
      verdict: 'block',
      metadata: { reason: 'approval_required' }
    });

    repository.saveRun(firstRun);
    repository.saveRun(secondRun);
    const snapshot = repository.exportSnapshot();
    const restored = new SandboxRepository();
    restored.restoreSnapshot(snapshot);

    expect(Object.keys(snapshot)).toEqual(['runs']);
    expect(restored.listRuns()).toEqual([firstRun, secondRun]);
    expect(restored.getRun(firstRun.runId)).toEqual(firstRun);

    snapshot.runs.reverse();
    snapshot.runs[1].evidenceIds?.push('mutated-evidence');
    snapshot.runs[1].metadata = { mutated: true };

    expect(repository.listRuns()).toEqual([firstRun, secondRun]);
    expect(restored.listRuns()).toEqual([firstRun, secondRun]);
  });

  it('parses restored sandbox snapshots before replacing current runs', () => {
    const repository = new SandboxRepository();
    const existingRun = buildRun('sandbox-run-existing');
    repository.saveRun(existingRun);

    expect(() =>
      repository.restoreSnapshot({
        runs: [{ ...buildRun('sandbox-run-invalid'), status: 'not-a-status' } as unknown as SandboxRunRecord]
      })
    ).toThrow();

    expect(repository.listRuns()).toEqual([existingRun]);
  });
});

function buildRun(runId: string, overrides: Partial<SandboxRunRecord> = {}): SandboxRunRecord {
  return {
    runId,
    requestId: `request-${runId}`,
    taskId: `task-${runId}`,
    sessionId: `session-${runId}`,
    profile: 'workspace-write',
    stage: 'preflight',
    status: 'passed',
    attempt: 1,
    maxAttempts: 1,
    verdict: 'allow',
    createdAt: '2026-04-26T00:00:00.000Z',
    updatedAt: '2026-04-26T00:00:00.000Z',
    metadata: {},
    ...overrides
  };
}
