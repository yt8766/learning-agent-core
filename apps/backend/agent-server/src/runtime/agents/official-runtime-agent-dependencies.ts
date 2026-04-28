import type { AgentRegistry, RuntimeAgentDependencies } from '@agent/runtime';
import {
  OFFICIAL_CODER_PRIMARY_CAPABILITY,
  createOfficialAgentRegistry,
  type OfficialCoderAgentModule,
  OFFICIAL_DATA_REPORT_PRIMARY_CAPABILITY,
  OFFICIAL_REVIEWER_PRIMARY_CAPABILITY,
  OFFICIAL_SUPERVISOR_PRIMARY_CAPABILITY,
  type OfficialDataReportAgentModule,
  type OfficialPlatformAgentModule,
  type OfficialReviewerAgentModule,
  type OfficialSupervisorAgentModule
} from './official-agent-registry';

function requireOfficialAgentModule<TAgentModule extends OfficialPlatformAgentModule>(
  registry: AgentRegistry<OfficialPlatformAgentModule>,
  input: {
    capabilityId: string;
    fallbackAgentId?: string;
    displayName: string;
  }
): TAgentModule {
  const provider =
    registry.findAgentsByCapability(input.capabilityId)[0] ??
    (input.fallbackAgentId ? registry.findAgentById(input.fallbackAgentId) : undefined);

  if (!provider) {
    throw new Error(`Missing ${input.displayName} platform agent registration for capability "${input.capabilityId}".`);
  }

  return provider.createAgent() as TAgentModule;
}

function collectMatchedAgentIds(
  registry: AgentRegistry<OfficialPlatformAgentModule>,
  record: { domain: string; requiredCapabilities?: string[] }
) {
  const capabilityMatches = (record.requiredCapabilities ?? []).flatMap(capability =>
    registry.findAgentsByCapability(capability).map(agent => agent.descriptor.id)
  );
  const domainMatches = registry.findAgentsByDomain(record.domain as never).map(agent => agent.descriptor.id);

  return Array.from(new Set([...capabilityMatches, ...domainMatches]));
}

function enrichSpecialistRecord<
  TRecord extends { domain: string; requiredCapabilities?: string[]; agentId?: string; candidateAgentIds?: string[] }
>(registry: AgentRegistry<OfficialPlatformAgentModule>, record: TRecord): TRecord {
  const matchedAgents = collectMatchedAgentIds(registry, record);

  if (matchedAgents.length === 0) {
    return record;
  }

  return {
    ...record,
    agentId: record.agentId ?? matchedAgents[0],
    candidateAgentIds: record.candidateAgentIds ?? matchedAgents
  };
}

function enrichSpecialistRoute(
  registry: AgentRegistry<OfficialPlatformAgentModule>,
  route: ReturnType<OfficialSupervisorAgentModule['resolveSpecialistRoute']>
) {
  return {
    ...route,
    specialistLead: enrichSpecialistRecord(registry, route.specialistLead),
    supportingSpecialists: route.supportingSpecialists.map(item => enrichSpecialistRecord(registry, item))
  };
}

export function createOfficialRuntimeAgentDependencies(
  options: { agentRegistry?: AgentRegistry<OfficialPlatformAgentModule> } = {}
): RuntimeAgentDependencies {
  const registry = options.agentRegistry ?? createOfficialAgentRegistry();
  const supervisor = requireOfficialAgentModule<OfficialSupervisorAgentModule>(registry, {
    capabilityId: OFFICIAL_SUPERVISOR_PRIMARY_CAPABILITY,
    fallbackAgentId: 'official.supervisor',
    displayName: 'supervisor'
  });
  const coder = requireOfficialAgentModule<OfficialCoderAgentModule>(registry, {
    capabilityId: OFFICIAL_CODER_PRIMARY_CAPABILITY,
    fallbackAgentId: 'official.coder',
    displayName: 'coder'
  });
  const reviewer = requireOfficialAgentModule<OfficialReviewerAgentModule>(registry, {
    capabilityId: OFFICIAL_REVIEWER_PRIMARY_CAPABILITY,
    fallbackAgentId: 'official.reviewer',
    displayName: 'reviewer'
  });
  const dataReport = requireOfficialAgentModule<OfficialDataReportAgentModule>(registry, {
    capabilityId: OFFICIAL_DATA_REPORT_PRIMARY_CAPABILITY,
    fallbackAgentId: 'official.data-report',
    displayName: 'data-report'
  });

  return {
    createLibuRouterMinistry: context => new supervisor.LibuRouterMinistry(context),
    createHubuSearchMinistry: context => new supervisor.HubuSearchMinistry(context),
    createLibuDocsMinistry: context => new supervisor.LibuDocsMinistry(context),
    createGongbuCodeMinistry: context => new coder.GongbuCodeMinistry(context),
    createBingbuOpsMinistry: context => new coder.BingbuOpsMinistry(context),
    createXingbuReviewMinistry: context => new reviewer.XingbuReviewMinistry(context),
    listBootstrapSkills: supervisor.listBootstrapSkills,
    buildResearchSourcePlan: supervisor.buildResearchSourcePlan,
    initializeTaskExecutionSteps: supervisor.initializeTaskExecutionSteps,
    markExecutionStepBlocked: supervisor.markExecutionStepBlocked,
    markExecutionStepCompleted: supervisor.markExecutionStepCompleted,
    markExecutionStepResumed: supervisor.markExecutionStepResumed,
    markExecutionStepStarted: supervisor.markExecutionStepStarted,
    mergeEvidence: supervisor.mergeEvidence,
    resolveSpecialistRoute: input => enrichSpecialistRoute(registry, supervisor.resolveSpecialistRoute(input)),
    resolveWorkflowPreset: supervisor.resolveWorkflowPreset,
    resolveWorkflowRoute: supervisor.resolveWorkflowRoute,
    runDispatchStage: supervisor.runDispatchStage,
    runGoalIntakeStage: supervisor.runGoalIntakeStage,
    runManagerPlanStage: supervisor.runManagerPlanStage,
    runRouteStage: supervisor.runRouteStage,
    buildDataReportContract: dataReport.buildDataReportContract,
    appendDataReportContext: dataReport.appendDataReportContext
  };
}
