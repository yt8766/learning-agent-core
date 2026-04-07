import { describe, expect, it, vi } from 'vitest';

import { PlatformController } from '../../src/platform/platform.controller';

function createController() {
  const runtimeCentersService = {
    getPlatformConsole: vi.fn(async (...args) => ({ scope: 'console', args })),
    getRuntimeCenter: vi.fn((...args) => ({ scope: 'runtime', args })),
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
    getBriefingRuns: vi.fn((...args) => ({ scope: 'briefings', args })),
    forceBriefingRun: vi.fn(category => ({ category, forced: true })),
    recordBriefingFeedback: vi.fn(body => ({ saved: true, body })),
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
    configureConnector: vi.fn(dto => ({ ...dto, configured: true })),
    getEvalsCenter: vi.fn((...args) => ({ scope: 'evals', args })),
    exportRuntimeCenter: vi.fn(args => ({ scope: 'runtimeExport', args })),
    exportApprovalsCenter: vi.fn(args => ({ scope: 'approvalsExport', args })),
    exportEvalsCenter: vi.fn(args => ({ scope: 'evalsExport', args }))
  };
  const runtimeToolsService = {
    getToolsCenter: vi.fn(() => ({ scope: 'tools' }))
  };

  return {
    controller: new PlatformController(runtimeCentersService as never, runtimeToolsService as never),
    runtimeCentersService,
    runtimeToolsService
  };
}

describe('PlatformController', () => {
  it('delegates runtime, console and approval queries with normalized day params', async () => {
    const { controller, runtimeCentersService, runtimeToolsService } = createController();

    await expect(
      controller.getConsole(
        '7',
        'running',
        'gpt-5.4',
        'provider-billing',
        'plan',
        'plan-question',
        'execute',
        'approval'
      )
    ).resolves.toEqual(
      expect.objectContaining({
        scope: 'console'
      })
    );
    expect(runtimeCentersService.getPlatformConsole).toHaveBeenCalledWith(7, {
      status: 'running',
      model: 'gpt-5.4',
      pricingSource: 'provider-billing',
      runtimeExecutionMode: 'plan',
      runtimeInteractionKind: 'plan-question',
      approvalsExecutionMode: 'execute',
      approvalsInteractionKind: 'approval'
    });

    expect(controller.getRuntimeCenter('30', 'failed', 'gpt-5.4-mini', 'estimated', 'execute', 'approval')).toEqual(
      expect.objectContaining({
        scope: 'runtime'
      })
    );
    expect(runtimeCentersService.getRuntimeCenter).toHaveBeenCalledWith(30, {
      status: 'failed',
      model: 'gpt-5.4-mini',
      pricingSource: 'estimated',
      executionMode: 'execute',
      interactionKind: 'approval'
    });

    expect(controller.getApprovalsCenter('plan', 'plan-question')).toEqual(
      expect.objectContaining({
        scope: 'approvals'
      })
    );
    expect(runtimeCentersService.getApprovalsCenter).toHaveBeenCalledWith({
      executionMode: 'plan',
      interactionKind: 'plan-question'
    });
    expect(controller.listApprovalScopePolicies()).toEqual(['policy-1']);
    expect(controller.revokeApprovalScopePolicy('policy-1')).toEqual({ policyId: 'policy-1', revoked: true });
    expect(controller.getBriefingRuns('7', 'general-security')).toEqual(
      expect.objectContaining({ scope: 'briefings' })
    );
    expect(runtimeCentersService.getBriefingRuns).toHaveBeenCalledWith(7, 'general-security');
    expect(controller.forceBriefingRun('backend-tech')).toEqual({ category: 'backend-tech', forced: true });
    expect(
      controller.recordBriefingFeedback({
        messageKey: 'general-security:postgres',
        category: 'general-security',
        feedbackType: 'helpful',
        reasonTag: 'useful-actionable'
      })
    ).toEqual({
      saved: true,
      body: {
        messageKey: 'general-security:postgres',
        category: 'general-security',
        feedbackType: 'helpful',
        reasonTag: 'useful-actionable'
      }
    });
    expect(controller.getToolsCenter()).toEqual({ scope: 'tools' });
    expect(runtimeToolsService.getToolsCenter).toHaveBeenCalledTimes(1);
  });

  it('delegates learning, evidence, connector and company agent actions', async () => {
    const { controller, runtimeCentersService } = createController();

    expect(controller.getLearningCenter()).toEqual({ scope: 'learning' });
    expect(controller.getCounselorSelectorConfigs()).toEqual(['selector-1']);
    expect(
      controller.upsertCounselorSelectorConfig({
        selectorId: 'sel-1',
        domain: 'frontend',
        strategy: 'weighted',
        candidateIds: ['c1'],
        defaultCounselorId: 'c1',
        enabled: true
      } as any)
    ).toEqual(expect.objectContaining({ saved: true }));
    expect(controller.enableCounselorSelector('sel-1')).toEqual({ selectorId: 'sel-1', enabled: true });
    expect(controller.disableCounselorSelector('sel-1')).toEqual({ selectorId: 'sel-1', enabled: false });
    expect(controller.setLearningConflictStatus('conf-1', 'merged', { preferredMemoryId: 'mem-1' })).toEqual({
      conflictId: 'conf-1',
      status: 'merged',
      preferredMemoryId: 'mem-1'
    });
    expect(controller.getEvidenceCenter()).toEqual({ scope: 'evidence' });
    expect(controller.getBrowserReplay('session-1')).toEqual({ sessionId: 'session-1', replay: true });
    await expect(controller.getConnectorsCenter()).resolves.toEqual({ scope: 'connectors' });
    expect(controller.getCompanyAgentsCenter()).toEqual({ scope: 'companyAgents' });
    expect(controller.enableCompanyAgent('worker-1')).toEqual({ workerId: 'worker-1', enabled: true });
    expect(controller.disableCompanyAgent('worker-1')).toEqual({ workerId: 'worker-1', enabled: false });
    expect(controller.enableConnector('conn-1')).toEqual({ connectorId: 'conn-1', enabled: true });
    expect(controller.disableConnector('conn-1')).toEqual({ connectorId: 'conn-1', enabled: false });
    expect(controller.setConnectorPolicy('conn-1', 'require-approval')).toEqual({
      connectorId: 'conn-1',
      effect: 'require-approval'
    });
    expect(controller.clearConnectorPolicy('conn-1')).toEqual({ connectorId: 'conn-1', cleared: true });
    expect(controller.setCapabilityPolicy('conn-1', 'cap-1', 'deny')).toEqual({
      connectorId: 'conn-1',
      capabilityId: 'cap-1',
      effect: 'deny'
    });
    expect(controller.clearCapabilityPolicy('conn-1', 'cap-1')).toEqual({
      connectorId: 'conn-1',
      capabilityId: 'cap-1',
      cleared: true
    });
    await expect(controller.closeConnectorSession('conn-1')).resolves.toEqual({
      connectorId: 'conn-1',
      closed: true
    });
    expect(controller.refreshConnectorDiscovery('conn-1')).toEqual({ connectorId: 'conn-1', refreshed: true });
    expect(controller.configureConnector({ connectorId: 'conn-1', transport: 'stdio' } as any)).toEqual(
      expect.objectContaining({ configured: true })
    );
    expect(runtimeCentersService.configureConnector).toHaveBeenCalled();
  });

  it('delegates skill source, eval export and install flows', async () => {
    const { controller, runtimeCentersService } = createController();

    await expect(controller.getSkillSourcesCenter()).resolves.toEqual({ scope: 'skillSources' });
    expect(controller.installSkill({ sourceId: 'local-skill' } as any)).toEqual({
      type: 'local',
      dto: { sourceId: 'local-skill' }
    });
    expect(controller.installRemoteSkill({ repo: 'org/repo' } as any)).toEqual({
      type: 'remote',
      dto: { repo: 'org/repo' }
    });
    expect(controller.checkInstalledSkills()).toEqual({ checked: true });
    expect(controller.updateInstalledSkills()).toEqual({ updated: true });
    expect(controller.getSkillInstallReceipt('receipt-1')).toEqual({ receiptId: 'receipt-1' });
    expect(controller.enableSkillSource('source-1')).toEqual({ sourceId: 'source-1', enabled: true });
    expect(controller.disableSkillSource('source-1')).toEqual({ sourceId: 'source-1', enabled: false });
    expect(controller.syncSkillSource('source-1')).toEqual({ sourceId: 'source-1', synced: true });
    expect(controller.approveSkillInstall('receipt-1', { note: 'ok' } as any)).toEqual({
      receiptId: 'receipt-1',
      action: 'approve',
      dto: { note: 'ok' }
    });
    expect(controller.rejectSkillInstall('receipt-1', { note: 'nope' } as any)).toEqual({
      receiptId: 'receipt-1',
      action: 'reject',
      dto: { note: 'nope' }
    });

    expect(controller.getEvalsCenter('14', 'runtime-smoke', 'passed')).toEqual(
      expect.objectContaining({ scope: 'evals' })
    );
    expect(runtimeCentersService.getEvalsCenter).toHaveBeenCalledWith(14, {
      scenarioId: 'runtime-smoke',
      outcome: 'passed'
    });
    expect(controller.exportRuntimeCenter('30', 'running', 'gpt-5.4', 'billing', 'plan', 'approval', 'json')).toEqual(
      expect.objectContaining({ scope: 'runtimeExport' })
    );
    expect(runtimeCentersService.exportRuntimeCenter).toHaveBeenCalledWith({
      days: 30,
      status: 'running',
      model: 'gpt-5.4',
      pricingSource: 'billing',
      executionMode: 'plan',
      interactionKind: 'approval',
      format: 'json'
    });
    expect(controller.exportApprovalsCenter('execute', 'approval', 'md')).toEqual(
      expect.objectContaining({ scope: 'approvalsExport' })
    );
    expect(controller.exportEvalsCenter('21', 'scenario-1', 'failed', 'csv')).toEqual(
      expect.objectContaining({ scope: 'evalsExport' })
    );
  });

  it('passes undefined day filters through console/runtime/eval exports', async () => {
    const { controller, runtimeCentersService } = createController();

    await expect(controller.getConsole(undefined, undefined, 'gpt-5.4')).resolves.toEqual(
      expect.objectContaining({ scope: 'console' })
    );
    expect(runtimeCentersService.getPlatformConsole).toHaveBeenCalledWith(undefined, {
      status: undefined,
      model: 'gpt-5.4',
      pricingSource: undefined,
      runtimeExecutionMode: undefined,
      runtimeInteractionKind: undefined,
      approvalsExecutionMode: undefined,
      approvalsInteractionKind: undefined
    });

    expect(controller.getRuntimeCenter(undefined, undefined, undefined, undefined, undefined, undefined)).toEqual(
      expect.objectContaining({ scope: 'runtime' })
    );
    expect(runtimeCentersService.getRuntimeCenter).toHaveBeenCalledWith(undefined, {
      status: undefined,
      model: undefined,
      pricingSource: undefined,
      executionMode: undefined,
      interactionKind: undefined
    });

    expect(controller.getEvalsCenter(undefined, undefined, undefined)).toEqual(
      expect.objectContaining({ scope: 'evals' })
    );
    expect(runtimeCentersService.getEvalsCenter).toHaveBeenCalledWith(undefined, {
      scenarioId: undefined,
      outcome: undefined
    });

    expect(
      controller.exportRuntimeCenter(undefined, undefined, undefined, undefined, undefined, undefined, 'json')
    ).toEqual(expect.objectContaining({ scope: 'runtimeExport' }));
    expect(runtimeCentersService.exportRuntimeCenter).toHaveBeenCalledWith({
      days: undefined,
      status: undefined,
      model: undefined,
      pricingSource: undefined,
      executionMode: undefined,
      interactionKind: undefined,
      format: 'json'
    });

    expect(controller.exportEvalsCenter(undefined, undefined, undefined, 'md')).toEqual(
      expect.objectContaining({ scope: 'evalsExport' })
    );
    expect(runtimeCentersService.exportEvalsCenter).toHaveBeenCalledWith({
      days: undefined,
      scenarioId: undefined,
      outcome: undefined,
      format: 'md'
    });
  });
});
