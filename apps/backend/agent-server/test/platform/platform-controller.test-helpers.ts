import { vi } from 'vitest';

export function createPlatformControllerDeps() {
  const runtimeCentersService = {
    getPlatformConsole: vi.fn(async (...args) => ({ scope: 'console', args })),
    getPlatformConsoleShell: vi.fn(async (...args) => ({ scope: 'console-shell', args })),
    getRuntimeCenter: vi.fn((...args) => ({ scope: 'runtime', args })),
    getRunObservatory: vi.fn(args => ({ scope: 'run-observatory', args })),
    getRunObservatoryDetail: vi.fn(taskId => ({ scope: 'run-observatory-detail', taskId })),
    getApprovalsCenter: vi.fn(args => ({ scope: 'approvals', args })),
    listApprovalScopePolicies: vi.fn(() => ['policy-1']),
    revokeApprovalScopePolicy: vi.fn(policyId => ({ policyId, revoked: true })),
    getLearningCenter: vi.fn(() => ({ scope: 'learning' })),
    getCounselorSelectorConfigs: vi.fn(() => ['selector-1']),
    upsertCounselorSelectorConfig: vi.fn(dto => ({ ...dto, saved: true })),
    setCounselorSelectorEnabled: vi.fn((selectorId, enabled) => ({ selectorId, enabled })),
    setLearningConflictStatus: vi.fn((conflictId, status, preferredMemoryId) => ({
      conflictId,
      status,
      preferredMemoryId
    })),
    getEvidenceCenter: vi.fn(() => ({ scope: 'evidence' })),
    getBrowserReplay: vi.fn(sessionId => ({ sessionId, replay: true })),
    getConnectorsCenter: vi.fn(async () => ({ scope: 'connectors' })),
    getSkillSourcesCenter: vi.fn(async () => ({ scope: 'skillSources' })),
    installSkill: vi.fn(dto => ({ type: 'local', dto })),
    installRemoteSkill: vi.fn(dto => ({ type: 'remote', dto })),
    checkInstalledSkills: vi.fn(() => ({ checked: true })),
    updateInstalledSkills: vi.fn(() => ({ updated: true })),
    getSkillInstallReceipt: vi.fn(receiptId => ({ receiptId })),
    setSkillSourceEnabled: vi.fn((sourceId, enabled) => ({ sourceId, enabled })),
    syncSkillSource: vi.fn(sourceId => ({ sourceId, synced: true })),
    approveSkillInstall: vi.fn((receiptId, dto) => ({ receiptId, action: 'approve', dto })),
    rejectSkillInstall: vi.fn((receiptId, dto) => ({ receiptId, action: 'reject', dto })),
    getCompanyAgentsCenter: vi.fn(() => ({ scope: 'companyAgents' })),
    setCompanyAgentEnabled: vi.fn((workerId, enabled) => ({ workerId, enabled })),
    setConnectorEnabled: vi.fn((connectorId, enabled) => ({ connectorId, enabled })),
    setConnectorApprovalPolicy: vi.fn((connectorId, effect) => ({ connectorId, effect })),
    clearConnectorApprovalPolicy: vi.fn(connectorId => ({ connectorId, cleared: true })),
    setCapabilityApprovalPolicy: vi.fn((connectorId, capabilityId, effect) => ({
      connectorId,
      capabilityId,
      effect
    })),
    clearCapabilityApprovalPolicy: vi.fn((connectorId, capabilityId) => ({
      connectorId,
      capabilityId,
      cleared: true
    })),
    closeConnectorSession: vi.fn(async connectorId => ({ connectorId, closed: true })),
    refreshConnectorDiscovery: vi.fn(connectorId => ({ connectorId, refreshed: true })),
    refreshMetricsSnapshots: vi.fn(days => ({ days, refreshed: true })),
    configureConnector: vi.fn(dto => ({ ...dto, configured: true })),
    getEvalsCenter: vi.fn((...args) => ({ scope: 'evals', args })),
    exportRuntimeCenter: vi.fn(args => ({ scope: 'runtimeExport', args })),
    exportApprovalsCenter: vi.fn(args => ({ scope: 'approvalsExport', args })),
    exportEvalsCenter: vi.fn(args => ({ scope: 'evalsExport', args })),
    getPlatformConsoleLogAnalysis: vi.fn((days?: number) => ({ days, sampleCount: 3 }))
  };
  const runtimeToolsService = {
    getToolsCenter: vi.fn(() => ({ scope: 'tools' }))
  };

  return {
    runtimeCentersService,
    runtimeToolsService
  };
}
