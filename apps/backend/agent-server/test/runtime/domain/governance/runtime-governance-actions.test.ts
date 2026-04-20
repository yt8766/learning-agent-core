import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { appendGovernanceAuditMock } = vi.hoisted(() => ({
  appendGovernanceAuditMock: vi.fn(async () => undefined)
}));

vi.mock('@agent/runtime', async importOriginal => {
  const actual = await importOriginal<typeof import('@agent/runtime')>();
  return {
    ...actual,
    appendGovernanceAudit: appendGovernanceAuditMock
  };
});

import {
  syncSkillSourceWithGovernance,
  setCompanyWorkerEnabledWithGovernance,
  setSkillSourceEnabledWithGovernance
} from '../../../../src/runtime/domain/governance/runtime-governance-actions';

describe('runtime governance actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('toggles skill-source governance state and returns the refreshed source view', async () => {
    const snapshot = { governance: { disabledSkillSourceIds: [] as string[] } };
    const runtimeStateRepository = {
      load: vi.fn(async () => snapshot),
      save: vi.fn(async () => undefined)
    };
    const listSkillSources = vi.fn(async () => [
      { id: 'source-1', enabled: true },
      { id: 'source-2', enabled: true }
    ]);

    await expect(
      setSkillSourceEnabledWithGovernance({
        sourceId: 'source-1',
        enabled: false,
        runtimeStateRepository,
        listSkillSources
      })
    ).resolves.toEqual({ id: 'source-1', enabled: true });

    expect(snapshot.governance.disabledSkillSourceIds).toEqual(['source-1']);
    expect(runtimeStateRepository.save).toHaveBeenCalledWith(snapshot);
    expect(appendGovernanceAuditMock).toHaveBeenCalledWith(
      runtimeStateRepository,
      expect.objectContaining({
        action: 'skill-source.disabled',
        scope: 'skill-source',
        targetId: 'source-1',
        outcome: 'success'
      })
    );
  });

  it('syncs a skill source through the domain action and records the governance audit result', async () => {
    const runtimeStateRepository = {
      load: vi.fn(async () => ({ governance: {}, governanceAudit: [] }) as any),
      save: vi.fn(async () => undefined)
    };
    const listSkillSources = vi.fn(async () => [{ id: 'source-1', enabled: true }]);
    const skillSourceSyncService = {
      syncSource: vi.fn(async () => ({
        status: 'failed' as const,
        manifestCount: 0,
        error: 'sync failed'
      }))
    };

    await expect(
      syncSkillSourceWithGovernance({
        sourceId: 'source-1',
        runtimeStateRepository: runtimeStateRepository as any,
        listSkillSources,
        skillSourceSyncService
      })
    ).resolves.toEqual({ id: 'source-1', enabled: true });

    expect(skillSourceSyncService.syncSource).toHaveBeenCalledWith({ id: 'source-1', enabled: true });
    expect(appendGovernanceAuditMock).toHaveBeenCalledWith(
      runtimeStateRepository,
      expect.objectContaining({
        action: 'skill-source.synced',
        targetId: 'source-1',
        outcome: 'rejected',
        reason: 'sync failed'
      })
    );
  });

  it('rejects missing skill sources before mutating governance state', async () => {
    const runtimeStateRepository = {
      load: vi.fn(async () => ({ governance: {} })),
      save: vi.fn(async () => undefined)
    };

    await expect(
      setSkillSourceEnabledWithGovernance({
        sourceId: 'missing-source',
        enabled: true,
        runtimeStateRepository,
        listSkillSources: async () => []
      })
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(runtimeStateRepository.save).not.toHaveBeenCalled();
    expect(appendGovernanceAuditMock).not.toHaveBeenCalled();
  });

  it('toggles company-worker governance state, updates the orchestrator, and returns the refreshed view', async () => {
    const snapshot = { governance: { disabledCompanyWorkerIds: [] as string[] } };
    const runtimeStateRepository = {
      load: vi.fn(async () => snapshot),
      save: vi.fn(async () => undefined)
    };
    const orchestrator = {
      listWorkers: vi.fn(() => [
        { id: 'worker-1', kind: 'company' },
        { id: 'worker-2', kind: 'shared' }
      ]),
      setWorkerEnabled: vi.fn()
    };
    const loadCompanyWorkerView = vi.fn(async () => ({ id: 'worker-1', enabled: false }));

    await expect(
      setCompanyWorkerEnabledWithGovernance({
        workerId: 'worker-1',
        enabled: false,
        runtimeStateRepository,
        orchestrator,
        loadCompanyWorkerView
      })
    ).resolves.toEqual({ id: 'worker-1', enabled: false });

    expect(snapshot.governance.disabledCompanyWorkerIds).toEqual(['worker-1']);
    expect(orchestrator.setWorkerEnabled).toHaveBeenCalledWith('worker-1', false);
    expect(loadCompanyWorkerView).toHaveBeenCalledWith('worker-1');
    expect(appendGovernanceAuditMock).toHaveBeenCalledWith(
      runtimeStateRepository,
      expect.objectContaining({
        action: 'company-worker.disabled',
        scope: 'company-worker',
        targetId: 'worker-1',
        outcome: 'success'
      })
    );
  });

  it('rejects missing company workers before mutating governance state', async () => {
    const runtimeStateRepository = {
      load: vi.fn(async () => ({ governance: {} })),
      save: vi.fn(async () => undefined)
    };
    const orchestrator = {
      listWorkers: vi.fn(() => [{ id: 'worker-2', kind: 'shared' }]),
      setWorkerEnabled: vi.fn()
    };

    await expect(
      setCompanyWorkerEnabledWithGovernance({
        workerId: 'missing-worker',
        enabled: true,
        runtimeStateRepository,
        orchestrator,
        loadCompanyWorkerView: async () => ({})
      })
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(runtimeStateRepository.save).not.toHaveBeenCalled();
    expect(orchestrator.setWorkerEnabled).not.toHaveBeenCalled();
    expect(appendGovernanceAuditMock).not.toHaveBeenCalled();
  });
});
