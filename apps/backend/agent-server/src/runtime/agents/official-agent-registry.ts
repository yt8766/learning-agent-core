import type { SpecialistDomain } from '@agent/core';
import type { AgentCapability, AgentRegistry, PlatformAgentDescriptor } from '@agent/runtime';
import { BingbuOpsMinistry, ExecutorAgent, GongbuCodeMinistry } from '@agent/agents-coder';
import {
  DataReportSandpackAgent,
  appendDataReportContext,
  buildDataReportContract,
  createDataReportSandpackGraph
} from '@agent/agents-data-report';
import { ReviewerAgent, XingbuReviewMinistry } from '@agent/agents-reviewer';
import {
  HubuSearchMinistry,
  LibuDocsMinistry,
  LibuRouterMinistry,
  buildResearchSourcePlan,
  createMainRouteGraph,
  initializeTaskExecutionSteps,
  listBootstrapSkills,
  markExecutionStepBlocked,
  markExecutionStepCompleted,
  markExecutionStepResumed,
  markExecutionStepStarted,
  mergeEvidence,
  resolveSpecialistRoute,
  resolveWorkflowPreset,
  resolveWorkflowRoute,
  runDispatchStage,
  runGoalIntakeStage,
  runManagerPlanStage,
  runRouteStage
} from '@agent/agents-supervisor';

import { StaticAgentRegistry, createRuntimeAgentProvider } from '@agent/platform-runtime';

export const OFFICIAL_SUPERVISOR_AGENT_ID = 'official.supervisor';
export const OFFICIAL_CODER_AGENT_ID = 'official.coder';
export const OFFICIAL_REVIEWER_AGENT_ID = 'official.reviewer';
export const OFFICIAL_DATA_REPORT_AGENT_ID = 'official.data-report';

export interface OfficialSupervisorAgentModule {
  readonly createMainRouteGraph: typeof createMainRouteGraph;
  readonly listBootstrapSkills: typeof listBootstrapSkills;
  readonly buildResearchSourcePlan: typeof buildResearchSourcePlan;
  readonly initializeTaskExecutionSteps: typeof initializeTaskExecutionSteps;
  readonly markExecutionStepBlocked: typeof markExecutionStepBlocked;
  readonly markExecutionStepCompleted: typeof markExecutionStepCompleted;
  readonly markExecutionStepResumed: typeof markExecutionStepResumed;
  readonly markExecutionStepStarted: typeof markExecutionStepStarted;
  readonly mergeEvidence: typeof mergeEvidence;
  readonly resolveWorkflowPreset: typeof resolveWorkflowPreset;
  readonly resolveWorkflowRoute: typeof resolveWorkflowRoute;
  readonly resolveSpecialistRoute: typeof resolveSpecialistRoute;
  readonly runGoalIntakeStage: typeof runGoalIntakeStage;
  readonly runRouteStage: typeof runRouteStage;
  readonly runManagerPlanStage: typeof runManagerPlanStage;
  readonly runDispatchStage: typeof runDispatchStage;
  readonly LibuRouterMinistry: typeof LibuRouterMinistry;
  readonly HubuSearchMinistry: typeof HubuSearchMinistry;
  readonly LibuDocsMinistry: typeof LibuDocsMinistry;
}

export interface OfficialCoderAgentModule {
  readonly ExecutorAgent: typeof ExecutorAgent;
  readonly GongbuCodeMinistry: typeof GongbuCodeMinistry;
  readonly BingbuOpsMinistry: typeof BingbuOpsMinistry;
}

export interface OfficialReviewerAgentModule {
  readonly ReviewerAgent: typeof ReviewerAgent;
  readonly XingbuReviewMinistry: typeof XingbuReviewMinistry;
}

export interface OfficialDataReportAgentModule {
  readonly DataReportSandpackAgent: typeof DataReportSandpackAgent;
  readonly createDataReportSandpackGraph: typeof createDataReportSandpackGraph;
  readonly buildDataReportContract: typeof buildDataReportContract;
  readonly appendDataReportContext: typeof appendDataReportContext;
}

export type OfficialPlatformAgentModule =
  | OfficialSupervisorAgentModule
  | OfficialCoderAgentModule
  | OfficialReviewerAgentModule
  | OfficialDataReportAgentModule;

export const OFFICIAL_SUPERVISOR_PRIMARY_CAPABILITY = 'workflow.routing';
export const OFFICIAL_CODER_PRIMARY_CAPABILITY = 'execution.code';
export const OFFICIAL_REVIEWER_PRIMARY_CAPABILITY = 'review.quality';
export const OFFICIAL_DATA_REPORT_PRIMARY_CAPABILITY = 'report.generation';
export const OFFICIAL_SUPERVISOR_CAPABILITIES = defineCapabilities([
  OFFICIAL_SUPERVISOR_PRIMARY_CAPABILITY,
  'workflow.planning',
  'workflow.dispatch',
  'research.sources'
]);
export const OFFICIAL_CODER_CAPABILITIES = defineCapabilities([
  OFFICIAL_CODER_PRIMARY_CAPABILITY,
  'execution.ops',
  'specialist.technical-architecture'
]);
export const OFFICIAL_REVIEWER_CAPABILITIES = defineCapabilities([
  OFFICIAL_REVIEWER_PRIMARY_CAPABILITY,
  'review.risk',
  'specialist.technical-architecture',
  'specialist.risk-compliance'
]);
export const OFFICIAL_DATA_REPORT_CAPABILITIES = defineCapabilities([
  OFFICIAL_DATA_REPORT_PRIMARY_CAPABILITY,
  'report.preview',
  'specialist.technical-architecture'
]);

function defineOfficialDescriptor(input: {
  id: string;
  displayName: string;
  capabilities: readonly AgentCapability[];
  domains?: readonly SpecialistDomain[];
  kind: 'orchestrator' | 'specialist';
}): PlatformAgentDescriptor {
  return {
    id: input.id,
    displayName: input.displayName,
    capabilities: input.capabilities.map(capability => capability.id),
    capabilityDescriptors: input.capabilities,
    domains: input.domains,
    kind: input.kind,
    source: 'official'
  };
}

function defineCapabilities(capabilityIds: readonly string[]): readonly AgentCapability[] {
  return capabilityIds.map(capabilityId => ({
    id: capabilityId,
    displayName: capabilityId
  }));
}

export function createOfficialAgentRegistry(): AgentRegistry<OfficialPlatformAgentModule> {
  return new StaticAgentRegistry<OfficialPlatformAgentModule>([
    createRuntimeAgentProvider<OfficialSupervisorAgentModule>({
      descriptor: defineOfficialDescriptor({
        id: OFFICIAL_SUPERVISOR_AGENT_ID,
        displayName: 'Supervisor',
        capabilities: OFFICIAL_SUPERVISOR_CAPABILITIES,
        kind: 'orchestrator'
      }),
      createAgent: () => ({
        createMainRouteGraph,
        listBootstrapSkills,
        buildResearchSourcePlan,
        initializeTaskExecutionSteps,
        markExecutionStepBlocked,
        markExecutionStepCompleted,
        markExecutionStepResumed,
        markExecutionStepStarted,
        mergeEvidence,
        resolveWorkflowPreset,
        resolveWorkflowRoute,
        resolveSpecialistRoute,
        runGoalIntakeStage,
        runRouteStage,
        runManagerPlanStage,
        runDispatchStage,
        LibuRouterMinistry,
        HubuSearchMinistry,
        LibuDocsMinistry
      })
    }),
    createRuntimeAgentProvider<OfficialCoderAgentModule>({
      descriptor: defineOfficialDescriptor({
        id: OFFICIAL_CODER_AGENT_ID,
        displayName: 'Coder',
        capabilities: OFFICIAL_CODER_CAPABILITIES,
        domains: ['technical-architecture'],
        kind: 'specialist'
      }),
      createAgent: () => ({
        ExecutorAgent,
        GongbuCodeMinistry,
        BingbuOpsMinistry
      })
    }),
    createRuntimeAgentProvider<OfficialReviewerAgentModule>({
      descriptor: defineOfficialDescriptor({
        id: OFFICIAL_REVIEWER_AGENT_ID,
        displayName: 'Reviewer',
        capabilities: OFFICIAL_REVIEWER_CAPABILITIES,
        domains: ['technical-architecture', 'risk-compliance'],
        kind: 'specialist'
      }),
      createAgent: () => ({
        ReviewerAgent,
        XingbuReviewMinistry
      })
    }),
    createRuntimeAgentProvider<OfficialDataReportAgentModule>({
      descriptor: defineOfficialDescriptor({
        id: OFFICIAL_DATA_REPORT_AGENT_ID,
        displayName: 'Data Report',
        capabilities: OFFICIAL_DATA_REPORT_CAPABILITIES,
        domains: ['technical-architecture'],
        kind: 'specialist'
      }),
      createAgent: () => ({
        DataReportSandpackAgent,
        createDataReportSandpackGraph,
        buildDataReportContract,
        appendDataReportContext
      })
    })
  ]);
}
