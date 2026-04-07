import { describe, expect, it, vi } from 'vitest';

import { RuntimeCentersGovernanceService } from '../../../src/runtime/centers/runtime-centers-governance.service';
import { RuntimeCentersQueryService } from '../../../src/runtime/centers/runtime-centers-query.service';
import { RuntimeCentersService } from '../../../src/runtime/centers/runtime-centers.service';

describe('RuntimeCentersService', () => {
  it('binds query and governance service methods onto the facade', async () => {
    const queryService = {
      getPlatformConsole: vi.fn(async () => ({ scope: 'console' })),
      getRuntimeCenter: vi.fn(async () => ({ scope: 'runtime' })),
      getApprovalsCenter: vi.fn(() => ({ scope: 'approvals' })),
      exportApprovalsCenter: vi.fn(() => ({ scope: 'approvals-export' })),
      getLearningCenter: vi.fn(async () => ({ scope: 'learning' })),
      getEvidenceCenter: vi.fn(async () => ({ scope: 'evidence' })),
      getConnectorsCenter: vi.fn(async () => ({ scope: 'connectors' })),
      getToolsCenter: vi.fn(() => ({ scope: 'tools' })),
      getBrowserReplay: vi.fn(() => ({ scope: 'replay' })),
      getSkillSourcesCenter: vi.fn(async () => ({ scope: 'skill-sources' })),
      getCompanyAgentsCenter: vi.fn(() => ({ scope: 'company-agents' })),
      getEvalsCenter: vi.fn(async () => ({ scope: 'evals' })),
      exportRuntimeCenter: vi.fn(() => ({ scope: 'runtime-export' })),
      exportEvalsCenter: vi.fn(() => ({ scope: 'evals-export' }))
    } as unknown as RuntimeCentersQueryService;
    const governanceService = {
      listApprovalScopePolicies: vi.fn(() => ['policy-1']),
      revokeApprovalScopePolicy: vi.fn(() => ({ revoked: true })),
      getCounselorSelectorConfigs: vi.fn(() => []),
      upsertCounselorSelectorConfig: vi.fn(() => ({ saved: true })),
      setCounselorSelectorEnabled: vi.fn(() => ({ enabled: true })),
      setLearningConflictStatus: vi.fn(() => ({ updated: true })),
      syncSkillSource: vi.fn(() => ({ synced: true })),
      installSkill: vi.fn(() => ({ installed: true })),
      installRemoteSkill: vi.fn(() => ({ remoteInstalled: true })),
      checkInstalledSkills: vi.fn(() => ({ checked: true })),
      updateInstalledSkills: vi.fn(() => ({ updated: true })),
      getSkillInstallReceipt: vi.fn(() => ({ receipt: true })),
      approveSkillInstall: vi.fn(() => ({ approved: true })),
      rejectSkillInstall: vi.fn(() => ({ rejected: true })),
      setSkillSourceEnabled: vi.fn(() => ({ enabled: true })),
      setCompanyAgentEnabled: vi.fn(() => ({ enabled: true })),
      setConnectorEnabled: vi.fn((connectorId: string, enabled: boolean) => ({ connectorId, enabled })),
      setConnectorApprovalPolicy: vi.fn(() => ({ policy: true })),
      clearConnectorApprovalPolicy: vi.fn(() => ({ cleared: true })),
      setCapabilityApprovalPolicy: vi.fn(() => ({ capabilityPolicy: true })),
      clearCapabilityApprovalPolicy: vi.fn(() => ({ capabilityPolicyCleared: true })),
      closeConnectorSession: vi.fn(async () => ({ closed: true })),
      refreshConnectorDiscovery: vi.fn(() => ({ refreshed: true })),
      configureConnector: vi.fn(() => ({ configured: true }))
    } as unknown as RuntimeCentersGovernanceService;

    const service = new RuntimeCentersService(() => ({}) as any, queryService, governanceService);

    await expect(service.getPlatformConsole()).resolves.toEqual({ scope: 'console' });
    await expect(service.getRuntimeCenter()).resolves.toEqual({ scope: 'runtime' });
    await expect(service.getConnectorsCenter()).resolves.toEqual({ scope: 'connectors' });
    expect(service.setConnectorEnabled('conn-1', true)).toEqual({ connectorId: 'conn-1', enabled: true });
  });
});
