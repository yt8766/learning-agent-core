import { describe, expect, it } from 'vitest';

import { ApprovalsCenterController } from '../../src/platform/approvals-center.controller';
import { CompanyAgentsCenterController } from '../../src/platform/company-agents-center.controller';
import { ConnectorsCenterController } from '../../src/platform/connectors-center.controller';
import { EvalsCenterController } from '../../src/platform/evals-center.controller';
import { EvidenceCenterController } from '../../src/platform/evidence-center.controller';
import { LearningCenterController } from '../../src/platform/learning-center.controller';
import { createPlatformControllerDeps } from './platform-controller.test-helpers';

describe('platform governance controllers', () => {
  it('delegates approvals, learning, evidence, connectors, company agents and evals', async () => {
    const { runtimeCentersService, runtimeToolsService } = createPlatformControllerDeps();
    const approvalsController = new ApprovalsCenterController(runtimeCentersService as never);
    const learningController = new LearningCenterController(runtimeCentersService as never);
    const evidenceController = new EvidenceCenterController(runtimeCentersService as never);
    const connectorsController = new ConnectorsCenterController(
      runtimeCentersService as never,
      runtimeToolsService as never
    );
    const companyAgentsController = new CompanyAgentsCenterController(runtimeCentersService as never);
    const evalsController = new EvalsCenterController(runtimeCentersService as never);

    expect(approvalsController.getApprovalsCenter({ executionMode: 'plan', interactionKind: 'plan-question' })).toEqual(
      expect.objectContaining({ scope: 'approvals' })
    );
    expect(approvalsController.listApprovalScopePolicies()).toEqual(['policy-1']);
    expect(approvalsController.revokeApprovalScopePolicy('policy-1')).toEqual({ policyId: 'policy-1', revoked: true });
    expect(approvalsController.exportApprovalsCenter({ executionMode: 'execute', format: 'md' })).toEqual(
      expect.objectContaining({ scope: 'approvalsExport' })
    );

    expect(learningController.getLearningCenter()).toEqual({ scope: 'learning' });
    expect(learningController.getCounselorSelectorConfigs()).toEqual(['selector-1']);
    expect(
      learningController.upsertCounselorSelectorConfig({
        selectorId: 'sel-1',
        domain: 'frontend',
        strategy: 'weighted',
        candidateIds: ['c1'],
        defaultCounselorId: 'c1',
        enabled: true
      } as never)
    ).toEqual(expect.objectContaining({ saved: true }));
    expect(learningController.enableCounselorSelector('sel-1')).toEqual({ selectorId: 'sel-1', enabled: true });
    expect(learningController.disableCounselorSelector('sel-1')).toEqual({ selectorId: 'sel-1', enabled: false });
    expect(learningController.setLearningConflictStatus('conf-1', 'merged', { preferredMemoryId: 'mem-1' })).toEqual({
      conflictId: 'conf-1',
      status: 'merged',
      preferredMemoryId: 'mem-1'
    });

    expect(evidenceController.getEvidenceCenter()).toEqual({ scope: 'evidence' });
    expect(evidenceController.getBrowserReplay('session-1')).toEqual({ sessionId: 'session-1', replay: true });

    await expect(connectorsController.getConnectorsCenter()).resolves.toEqual({ scope: 'connectors' });
    expect(connectorsController.getToolsCenter()).toEqual({ scope: 'tools' });
    expect(connectorsController.enableConnector('conn-1')).toEqual({ connectorId: 'conn-1', enabled: true });
    expect(connectorsController.disableConnector('conn-1')).toEqual({ connectorId: 'conn-1', enabled: false });
    expect(connectorsController.setConnectorPolicy('conn-1', 'require-approval')).toEqual({
      connectorId: 'conn-1',
      effect: 'require-approval'
    });
    expect(connectorsController.clearConnectorPolicy('conn-1')).toEqual({ connectorId: 'conn-1', cleared: true });
    expect(connectorsController.setCapabilityPolicy('conn-1', 'cap-1', 'deny')).toEqual({
      connectorId: 'conn-1',
      capabilityId: 'cap-1',
      effect: 'deny'
    });
    expect(connectorsController.clearCapabilityPolicy('conn-1', 'cap-1')).toEqual({
      connectorId: 'conn-1',
      capabilityId: 'cap-1',
      cleared: true
    });
    await expect(connectorsController.closeConnectorSession('conn-1')).resolves.toEqual({
      connectorId: 'conn-1',
      closed: true
    });
    expect(connectorsController.refreshConnectorDiscovery('conn-1')).toEqual({
      connectorId: 'conn-1',
      refreshed: true
    });
    expect(connectorsController.configureConnector({ connectorId: 'conn-1', transport: 'stdio' } as never)).toEqual(
      expect.objectContaining({ configured: true })
    );

    expect(companyAgentsController.getCompanyAgentsCenter()).toEqual({ scope: 'companyAgents' });
    expect(companyAgentsController.enableCompanyAgent('worker-1')).toEqual({ workerId: 'worker-1', enabled: true });
    expect(companyAgentsController.disableCompanyAgent('worker-1')).toEqual({ workerId: 'worker-1', enabled: false });

    expect(evalsController.getEvalsCenter({ scenarioId: 'runtime-smoke', outcome: 'passed' }, 14)).toEqual(
      expect.objectContaining({ scope: 'evals' })
    );
    expect(
      evalsController.exportEvalsCenter({ scenarioId: 'scenario-1', outcome: 'failed', format: 'csv' }, 21)
    ).toEqual(expect.objectContaining({ scope: 'evalsExport' }));
  });
});
