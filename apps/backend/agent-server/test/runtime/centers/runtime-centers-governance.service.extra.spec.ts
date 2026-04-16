import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  appendGovernanceAuditMock,
  listApprovalScopePoliciesMock,
  revokeApprovalScopePolicyMock,
  listSkillSourcesMock,
  buildCompanyAgentsCenterMock,
  setConnectorEnabledWithGovernanceMock,
  setConnectorApprovalPolicyWithGovernanceMock,
  clearConnectorApprovalPolicyWithGovernanceMock,
  setCapabilityApprovalPolicyWithGovernanceMock,
  clearCapabilityApprovalPolicyWithGovernanceMock,
  closeConnectorSessionWithGovernanceMock,
  refreshConnectorDiscoveryWithGovernanceMock,
  configureConnectorWithGovernanceMock,
  loadCounselorSelectorConfigsMock,
  persistCounselorSelectorConfigMock,
  persistCounselorSelectorEnabledMock,
  installSkillWithGovernanceMock,
  installRemoteSkillWithGovernanceMock,
  approveSkillInstallWithGovernanceMock,
  rejectSkillInstallWithGovernanceMock,
  checkInstalledSkillsMock,
  updateInstalledSkillsMock,
  getSkillInstallReceiptMock,
  listSkillManifestsMock,
  evaluateSkillManifestSafetyMock,
  writeSkillInstallReceiptMock,
  finalizeSkillInstallMock,
  finalizeRemoteSkillInstallMock,
  loadConnectorViewMock,
  registerConfiguredConnectorMock,
  registerDiscoveredCapabilitiesMock
} = vi.hoisted(() => ({
  appendGovernanceAuditMock: vi.fn(async () => undefined),
  listApprovalScopePoliciesMock: vi.fn(async () => [{ id: 'policy-1' }]),
  revokeApprovalScopePolicyMock: vi.fn(async () => true),
  listSkillSourcesMock: vi.fn(async () => [{ id: 'source-1' }]),
  buildCompanyAgentsCenterMock: vi.fn(() => [{ id: 'worker-1', enabled: false }]),
  setConnectorEnabledWithGovernanceMock: vi.fn(async () => ({ id: 'connector-1' })),
  setConnectorApprovalPolicyWithGovernanceMock: vi.fn(async (input: any) => {
    await input.loadConnectorView(input.connectorId);
    return { id: 'connector-1', effect: 'observe' };
  }),
  clearConnectorApprovalPolicyWithGovernanceMock: vi.fn(async (input: any) => {
    await input.loadConnectorView(input.connectorId);
    return { id: 'connector-1', cleared: true };
  }),
  setCapabilityApprovalPolicyWithGovernanceMock: vi.fn(async (input: any) => {
    await input.loadConnectorView(input.connectorId);
    return { id: 'capability-1', effect: 'allow' };
  }),
  clearCapabilityApprovalPolicyWithGovernanceMock: vi.fn(async (input: any) => {
    await input.loadConnectorView(input.connectorId);
    return { id: 'capability-1', cleared: true };
  }),
  closeConnectorSessionWithGovernanceMock: vi.fn(async () => ({ id: 'connector-1', closed: true })),
  refreshConnectorDiscoveryWithGovernanceMock: vi.fn(async (input: any) => {
    await input.registerDiscoveredCapabilities(input.connectorId);
    await input.loadConnectorView(input.connectorId);
    return { id: 'connector-1', refreshed: true };
  }),
  configureConnectorWithGovernanceMock: vi.fn(async (input: any) => {
    await input.registerConfiguredConnector(input.dto);
    await input.registerDiscoveredCapabilities(input.dto.connectorId);
    await input.loadConnectorView(input.dto.connectorId);
    return { id: 'connector-1', configured: true };
  }),
  loadCounselorSelectorConfigsMock: vi.fn(async () => [{ id: 'selector-1' }]),
  persistCounselorSelectorConfigMock: vi.fn(async () => ({ id: 'selector-1', enabled: true })),
  persistCounselorSelectorEnabledMock: vi.fn(async () => ({ id: 'selector-1', enabled: false })),
  installSkillWithGovernanceMock: vi.fn(async (input: any) => {
    await input.listSkillSources();
    await input.listSkillManifests();
    await input.evaluateSkillManifestSafety({ id: 'manifest-1' }, { id: 'source-1' });
    await input.writeSkillInstallReceipt({ id: 'receipt-install' });
    await input.finalizeSkillInstall({ id: 'manifest-1' }, { id: 'source-1' }, { id: 'receipt-install' });
    return { receiptId: 'receipt-install' };
  }),
  installRemoteSkillWithGovernanceMock: vi.fn(async (input: any) => {
    await input.listSkillSources();
    await input.writeSkillInstallReceipt({ id: 'receipt-remote' });
    await input.finalizeRemoteSkillInstall({ id: 'receipt-remote' });
    return { receiptId: 'receipt-remote' };
  }),
  approveSkillInstallWithGovernanceMock: vi.fn(async (input: any) => {
    await input.getSkillInstallReceipt(input.receiptId);
    await input.listSkillSources();
    await input.listSkillManifests();
    await input.writeSkillInstallReceipt({ id: input.receiptId });
    await input.finalizeSkillInstall({ id: 'manifest-1' }, { id: 'source-1' }, { id: input.receiptId });
    await input.finalizeRemoteSkillInstall({ id: input.receiptId });
    return { receiptId: 'receipt-install', status: 'approved' };
  }),
  rejectSkillInstallWithGovernanceMock: vi.fn(async (input: any) => {
    await input.getSkillInstallReceipt(input.receiptId);
    await input.writeSkillInstallReceipt({ id: input.receiptId });
    return { receiptId: 'receipt-install', status: 'rejected' };
  }),
  checkInstalledSkillsMock: vi.fn(async () => ({ stdout: 'check ok', stderr: '' })),
  updateInstalledSkillsMock: vi.fn(async () => ({ stdout: 'update ok', stderr: '' })),
  getSkillInstallReceiptMock: vi.fn(async () => ({ id: 'receipt-install' })),
  listSkillManifestsMock: vi.fn(async () => [{ id: 'manifest-1' }]),
  evaluateSkillManifestSafetyMock: vi.fn(async () => ({ verdict: 'allow' })),
  writeSkillInstallReceiptMock: vi.fn(async () => undefined),
  finalizeSkillInstallMock: vi.fn(async () => undefined),
  finalizeRemoteSkillInstallMock: vi.fn(async () => undefined),
  loadConnectorViewMock: vi.fn(async (ctx: any, id: string) => ({ id, ctx })),
  registerConfiguredConnectorMock: vi.fn(async () => undefined),
  registerDiscoveredCapabilitiesMock: vi.fn(async () => undefined)
}));

vi.mock('../../../src/modules/runtime-governance/services/runtime-governance-store', () => ({
  appendGovernanceAudit: appendGovernanceAuditMock,
  listApprovalScopePolicies: listApprovalScopePoliciesMock,
  revokeApprovalScopePolicy: revokeApprovalScopePolicyMock
}));

vi.mock('../../../src/runtime/skills/runtime-skill-sources.service', () => ({
  listSkillSources: listSkillSourcesMock,
  listSkillManifests: listSkillManifestsMock,
  searchLocalSkillSuggestions: vi.fn()
}));

vi.mock('../../../src/runtime/centers/runtime-company-agents-center', () => ({
  buildCompanyAgentsCenter: buildCompanyAgentsCenterMock
}));

vi.mock('../../../src/runtime/actions/runtime-connector-governance-actions', () => ({
  setConnectorEnabledWithGovernance: setConnectorEnabledWithGovernanceMock,
  setConnectorApprovalPolicyWithGovernance: setConnectorApprovalPolicyWithGovernanceMock,
  clearConnectorApprovalPolicyWithGovernance: clearConnectorApprovalPolicyWithGovernanceMock,
  setCapabilityApprovalPolicyWithGovernance: setCapabilityApprovalPolicyWithGovernanceMock,
  clearCapabilityApprovalPolicyWithGovernance: clearCapabilityApprovalPolicyWithGovernanceMock,
  closeConnectorSessionWithGovernance: closeConnectorSessionWithGovernanceMock,
  refreshConnectorDiscoveryWithGovernance: refreshConnectorDiscoveryWithGovernanceMock,
  configureConnectorWithGovernance: configureConnectorWithGovernanceMock
}));

vi.mock('../../../src/runtime/centers/runtime-centers-governance-counselors', () => ({
  getCounselorSelectorConfigs: loadCounselorSelectorConfigsMock,
  upsertCounselorSelectorConfig: persistCounselorSelectorConfigMock,
  setCounselorSelectorEnabled: persistCounselorSelectorEnabledMock
}));

vi.mock('../../../src/runtime/actions/runtime-skill-install-actions', () => ({
  installSkillWithGovernance: installSkillWithGovernanceMock,
  installRemoteSkillWithGovernance: installRemoteSkillWithGovernanceMock,
  approveSkillInstallWithGovernance: approveSkillInstallWithGovernanceMock,
  rejectSkillInstallWithGovernance: rejectSkillInstallWithGovernanceMock
}));

vi.mock('../../../src/runtime/skills/runtime-skill-install.service', () => ({
  checkInstalledSkills: checkInstalledSkillsMock,
  updateInstalledSkills: updateInstalledSkillsMock,
  getSkillInstallReceipt: getSkillInstallReceiptMock,
  finalizeRemoteSkillInstall: finalizeRemoteSkillInstallMock,
  finalizeSkillInstall: finalizeSkillInstallMock,
  writeSkillInstallReceipt: writeSkillInstallReceiptMock
}));

vi.mock('../../../src/runtime/helpers/runtime-connector-registry', () => ({
  getDisabledCompanyWorkerIds: vi.fn(() => ['worker-1']),
  registerConfiguredConnector: registerConfiguredConnectorMock,
  registerDiscoveredCapabilities: registerDiscoveredCapabilitiesMock
}));

vi.mock('../../../src/runtime/skills/runtime-skill-safety', () => ({
  evaluateSkillManifestSafety: evaluateSkillManifestSafetyMock
}));

vi.mock('../../../src/runtime/centers/runtime-centers-governance-connectors', () => ({
  loadConnectorView: loadConnectorViewMock
}));

import { RuntimeCentersGovernanceService } from '../../../src/runtime/centers/runtime-centers-governance.service';

describe('RuntimeCentersGovernanceService extra branches', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    revokeApprovalScopePolicyMock.mockResolvedValue(true);
    listSkillSourcesMock.mockResolvedValue([{ id: 'source-1' }]);
    buildCompanyAgentsCenterMock.mockReturnValue([{ id: 'worker-1', enabled: false }]);
  });

  function createContext() {
    const snapshot = { governance: {} as Record<string, unknown> };
    return {
      runtimeStateRepository: {
        load: vi.fn(async () => snapshot),
        save: vi.fn(async () => undefined)
      },
      settings: { profile: 'personal' },
      mcpServerRegistry: { id: 'server-registry' },
      mcpCapabilityRegistry: { id: 'capability-registry' },
      mcpClientManager: { id: 'client-manager' },
      describeConnectorProfilePolicy: vi.fn(() => 'observe'),
      orchestrator: {
        updateLearningConflictStatus: vi.fn(async () => ({ id: 'conflict-1', status: 'merged' })),
        listWorkers: vi.fn(() => [{ id: 'worker-1', kind: 'company' }]),
        setWorkerEnabled: vi.fn(),
        listTasks: vi.fn(() => [])
      },
      getConnectorRegistryContext: () => ({
        settings: {},
        orchestrator: {
          listWorkers: vi.fn(() => [{ id: 'worker-1', kind: 'company' }])
        }
      }),
      getSkillInstallContext: () => ({
        remoteSkillCli: {
          check: checkInstalledSkillsMock,
          update: updateInstalledSkillsMock
        }
      }),
      getSkillSourcesContext: () => ({
        skillSourceSyncService: {
          syncSource: vi.fn(async () => ({ status: 'failed', manifestCount: 0, error: 'sync failed' }))
        }
      })
    } as any;
  }

  it('lists approval policies and throws when revocation misses', async () => {
    const service = new RuntimeCentersGovernanceService(() => createContext());

    await expect(service.listApprovalScopePolicies()).resolves.toEqual([{ id: 'policy-1' }]);
    await expect(service.revokeApprovalScopePolicy('policy-1')).resolves.toBe(true);

    revokeApprovalScopePolicyMock.mockResolvedValueOnce(false);
    await expect(service.revokeApprovalScopePolicy('missing-policy')).rejects.toBeInstanceOf(NotFoundException);
    expect(appendGovernanceAuditMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'approval-policy.revoked',
        targetId: 'missing-policy',
        outcome: 'rejected'
      })
    );
  });

  it('forwards counselor and skill-install wrappers through the shared contexts', async () => {
    const context = createContext();
    const service = new RuntimeCentersGovernanceService(() => context);

    await expect(service.getCounselorSelectorConfigs()).resolves.toEqual([{ id: 'selector-1' }]);
    await expect(service.upsertCounselorSelectorConfig({ id: 'selector-1' } as any)).resolves.toEqual({
      id: 'selector-1',
      enabled: true
    });
    await expect(service.setCounselorSelectorEnabled('selector-1', false)).resolves.toEqual({
      id: 'selector-1',
      enabled: false
    });
    await expect(service.installSkill({ skillId: 'skill-a' } as any)).resolves.toEqual({
      receiptId: 'receipt-install'
    });
    await expect(service.installRemoteSkill({ repo: 'org/repo' } as any)).resolves.toEqual({
      receiptId: 'receipt-remote'
    });
    await expect(service.getSkillInstallReceipt('receipt-install')).resolves.toEqual({ id: 'receipt-install' });
    await expect(service.approveSkillInstall('receipt-install', {} as any)).resolves.toEqual({
      receiptId: 'receipt-install',
      status: 'approved'
    });
    await expect(service.rejectSkillInstall('receipt-install', {} as any)).resolves.toEqual({
      receiptId: 'receipt-install',
      status: 'rejected'
    });
    await expect(service.checkInstalledSkills()).resolves.toEqual({ stdout: 'check ok', stderr: '' });
    await expect(service.updateInstalledSkills()).resolves.toEqual({ stdout: 'update ok', stderr: '' });

    expect(loadCounselorSelectorConfigsMock).toHaveBeenCalledWith(context.runtimeStateRepository);
    expect(persistCounselorSelectorConfigMock).toHaveBeenCalledWith(context.runtimeStateRepository, {
      id: 'selector-1'
    });
    expect(persistCounselorSelectorEnabledMock).toHaveBeenCalledWith(
      context.runtimeStateRepository,
      'selector-1',
      false
    );
    expect(installSkillWithGovernanceMock).toHaveBeenCalled();
    expect(installRemoteSkillWithGovernanceMock).toHaveBeenCalled();
    expect(approveSkillInstallWithGovernanceMock).toHaveBeenCalled();
    expect(rejectSkillInstallWithGovernanceMock).toHaveBeenCalled();
    expect(getSkillInstallReceiptMock).toHaveBeenCalledWith(context.getSkillInstallContext(), 'receipt-install');
  });

  it('throws when learning conflict update misses and records the rejected audit', async () => {
    const context = createContext();
    const service = new RuntimeCentersGovernanceService(() => context);

    await expect(service.setLearningConflictStatus('conflict-1', 'merged', 'memory-1')).resolves.toEqual({
      id: 'conflict-1',
      status: 'merged'
    });
    expect(appendGovernanceAuditMock).toHaveBeenCalledWith(
      context.runtimeStateRepository,
      expect.objectContaining({
        action: 'learning-conflict.merged',
        targetId: 'conflict-1',
        outcome: 'success',
        reason: 'memory-1'
      })
    );

    context.orchestrator.updateLearningConflictStatus.mockResolvedValueOnce(undefined);
    await expect(service.setLearningConflictStatus('missing-conflict', 'dismissed')).rejects.toBeInstanceOf(
      NotFoundException
    );
    expect(appendGovernanceAuditMock).toHaveBeenCalledWith(
      context.runtimeStateRepository,
      expect.objectContaining({
        action: 'learning-conflict.dismissed',
        targetId: 'missing-conflict',
        outcome: 'rejected'
      })
    );
  });

  it('throws when syncing a missing skill source and records failed sync results', async () => {
    const context = createContext();
    const service = new RuntimeCentersGovernanceService(() => context);

    listSkillSourcesMock.mockResolvedValueOnce([]);
    await expect(service.syncSkillSource('missing-source')).rejects.toBeInstanceOf(NotFoundException);

    listSkillSourcesMock.mockResolvedValue([{ id: 'source-1' }]);
    await service.syncSkillSource('source-1');
    expect(appendGovernanceAuditMock).toHaveBeenCalledWith(
      context.runtimeStateRepository,
      expect.objectContaining({
        action: 'skill-source.synced',
        targetId: 'source-1',
        outcome: 'rejected',
        reason: 'sync failed'
      })
    );
  });

  it('toggles skill sources and company workers while rejecting unknown ids', async () => {
    const context = createContext();
    const service = new RuntimeCentersGovernanceService(() => context);

    listSkillSourcesMock.mockResolvedValueOnce([]);
    await expect(service.setSkillSourceEnabled('missing-source', true)).rejects.toBeInstanceOf(NotFoundException);

    listSkillSourcesMock.mockResolvedValue([{ id: 'source-1' }]);
    await expect(service.setSkillSourceEnabled('source-1', false)).resolves.toEqual({ id: 'source-1' });
    await expect(service.setSkillSourceEnabled('source-1', true)).resolves.toEqual({ id: 'source-1' });
    expect(context.runtimeStateRepository.save).toHaveBeenCalled();
    expect(appendGovernanceAuditMock).toHaveBeenCalledWith(
      context.runtimeStateRepository,
      expect.objectContaining({
        action: 'skill-source.disabled',
        targetId: 'source-1'
      })
    );

    context.orchestrator.listWorkers.mockReturnValueOnce([]);
    await expect(service.setCompanyAgentEnabled('missing-worker', true)).rejects.toBeInstanceOf(NotFoundException);

    await expect(service.setCompanyAgentEnabled('worker-1', true)).resolves.toEqual({ id: 'worker-1', enabled: false });
    await expect(service.setCompanyAgentEnabled('worker-1', false)).resolves.toEqual({
      id: 'worker-1',
      enabled: false
    });
    expect(context.orchestrator.setWorkerEnabled).toHaveBeenCalledWith('worker-1', true);
    expect(context.orchestrator.setWorkerEnabled).toHaveBeenCalledWith('worker-1', false);
    expect(buildCompanyAgentsCenterMock).toHaveBeenCalled();
  });

  it('forwards connector governance wrappers with the expected context', async () => {
    const context = createContext();
    const service = new RuntimeCentersGovernanceService(() => context);

    await expect(service.setConnectorEnabled('connector-1', true)).resolves.toEqual({ id: 'connector-1' });
    await expect(service.setConnectorApprovalPolicy('connector-1', 'observe')).resolves.toEqual({
      id: 'connector-1',
      effect: 'observe'
    });
    await expect(service.clearConnectorApprovalPolicy('connector-1')).resolves.toEqual({
      id: 'connector-1',
      cleared: true
    });
    await expect(service.setCapabilityApprovalPolicy('connector-1', 'cap-1', 'allow')).resolves.toEqual({
      id: 'capability-1',
      effect: 'allow'
    });
    await expect(service.clearCapabilityApprovalPolicy('connector-1', 'cap-1')).resolves.toEqual({
      id: 'capability-1',
      cleared: true
    });
    await expect(service.closeConnectorSession('connector-1')).resolves.toEqual({ id: 'connector-1', closed: true });
    await expect(service.refreshConnectorDiscovery('connector-1')).resolves.toEqual({
      id: 'connector-1',
      refreshed: true
    });
    await expect(service.configureConnector({ connectorId: 'connector-1' } as any)).resolves.toEqual({
      id: 'connector-1',
      configured: true
    });

    expect(setConnectorEnabledWithGovernanceMock).toHaveBeenCalledWith(
      expect.objectContaining({
        connectorId: 'connector-1',
        enabled: true,
        profile: 'personal',
        runtimeStateRepository: context.runtimeStateRepository
      })
    );
    expect(setConnectorApprovalPolicyWithGovernanceMock).toHaveBeenCalled();
    expect(clearConnectorApprovalPolicyWithGovernanceMock).toHaveBeenCalled();
    expect(setCapabilityApprovalPolicyWithGovernanceMock).toHaveBeenCalled();
    expect(clearCapabilityApprovalPolicyWithGovernanceMock).toHaveBeenCalled();
    expect(closeConnectorSessionWithGovernanceMock).toHaveBeenCalledWith(
      expect.objectContaining({
        connectorId: 'connector-1',
        mcpClientManager: context.mcpClientManager
      })
    );
    expect(refreshConnectorDiscoveryWithGovernanceMock).toHaveBeenCalled();
    expect(configureConnectorWithGovernanceMock).toHaveBeenCalled();
  });
});
