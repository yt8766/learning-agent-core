import type {
  CreateTaskDto,
  ChatRouteRecord,
  CodeExecutionMinistryLike,
  DeliveryMinistryLike,
  EvidenceRecord,
  ExecutionMode,
  ExecutionPlanMode,
  ExecutionStepOwner,
  ExecutionStepStage,
  OpsExecutionMinistryLike,
  RequestedExecutionHints,
  ResearchMinistryLike,
  ReviewMinistryLike,
  RouterMinistryLike,
  SpecialistDomain,
  SourcePolicyMode,
  ContextSliceRecord,
  WorkflowPresetDefinition
} from '@agent/core';

import type { AgentRuntimeContext } from '../runtime/agent-runtime-context';
import type { RuntimeTaskRecord } from '../runtime/runtime-task.types';

export interface BootstrapSkillRecord {
  id: string;
  displayName: string;
  description: string;
  required?: boolean;
  defaultEnabled?: boolean;
  tags?: string[];
}

export interface RuntimeWorkflowResolution {
  preset: WorkflowPresetDefinition;
  normalizedGoal: string;
  command?: string;
  source?: string;
}

export interface RuntimeSpecialistLeadRecord {
  id: SpecialistDomain;
  displayName: string;
  domain: SpecialistDomain;
  reason?: string;
  requiredCapabilities?: string[];
  agentId?: string;
  candidateAgentIds?: string[];
}

export interface RuntimeSpecialistSupportRecord {
  id: SpecialistDomain;
  displayName: string;
  domain: SpecialistDomain;
  reason?: string;
  requiredCapabilities?: string[];
  agentId?: string;
  candidateAgentIds?: string[];
}

export interface RuntimeSpecialistRoute {
  specialistLead: RuntimeSpecialistLeadRecord;
  supportingSpecialists: RuntimeSpecialistSupportRecord[];
  routeConfidence: number;
  contextSlicesBySpecialist: ContextSliceRecord[];
}

export type DataReportScope = 'single' | 'multiple' | 'shell-first';

export interface DataReportContract {
  scope: DataReportScope;
  templateRef: 'bonusCenterData' | 'generic-report';
  templatePathHint?: string;
  componentPattern: string[];
  implementationNotes: string[];
  executionStages: string[];
  contextBlock: string;
}

export interface RuntimeAgentDependencies {
  createLibuRouterMinistry: (context: AgentRuntimeContext) => RouterMinistryLike;
  createHubuSearchMinistry: (context: AgentRuntimeContext) => ResearchMinistryLike;
  createLibuDocsMinistry: (context: AgentRuntimeContext) => DeliveryMinistryLike;
  createGongbuCodeMinistry: (context: AgentRuntimeContext) => CodeExecutionMinistryLike;
  createBingbuOpsMinistry: (context: AgentRuntimeContext) => OpsExecutionMinistryLike;
  createXingbuReviewMinistry: (context: AgentRuntimeContext) => ReviewMinistryLike;
  listBootstrapSkills: () => BootstrapSkillRecord[];
  buildResearchSourcePlan: (input: {
    taskId: string;
    runId?: string;
    goal: string;
    workflow?: WorkflowPresetDefinition;
    runtimeSourcePolicyMode?: SourcePolicyMode;
    executionMode?: ExecutionMode;
    preferredUrls?: string[];
    createdAt?: string;
  }) => EvidenceRecord[];
  initializeTaskExecutionSteps: (task: RuntimeTaskRecord) => void;
  markExecutionStepBlocked: (
    task: RuntimeTaskRecord,
    stage: ExecutionStepStage,
    reason?: string,
    detail?: string,
    owner?: ExecutionStepOwner
  ) => void;
  markExecutionStepCompleted: (
    task: RuntimeTaskRecord,
    stage: ExecutionStepStage,
    summary: string,
    owner?: ExecutionStepOwner
  ) => void;
  markExecutionStepResumed: (
    task: RuntimeTaskRecord,
    stage: ExecutionStepStage,
    summary: string,
    owner?: ExecutionStepOwner
  ) => void;
  markExecutionStepStarted: (
    task: RuntimeTaskRecord,
    stage: ExecutionStepStage,
    summary: string,
    owner?: ExecutionStepOwner
  ) => void;
  mergeEvidence: (existing: EvidenceRecord[], incoming: EvidenceRecord[]) => EvidenceRecord[];
  resolveSpecialistRoute: (input: {
    goal: string;
    context?: string;
    requestedHints?: RequestedExecutionHints;
    externalSources?: EvidenceRecord[];
    conversationSummary?: string;
    recentTurns?: CreateTaskDto['recentTurns'];
    relatedHistory?: CreateTaskDto['relatedHistory'];
  }) => RuntimeSpecialistRoute;
  resolveWorkflowPreset: (
    goal: string,
    options?: {
      constraints?: string[];
      context?: string;
    }
  ) => RuntimeWorkflowResolution;
  resolveWorkflowRoute: (input: {
    goal: string;
    context?: string;
    workflow?: WorkflowPresetDefinition;
    requestedMode?: ExecutionPlanMode;
    requestedHints?: RequestedExecutionHints;
    capabilityAttachments?: CreateTaskDto['capabilityAttachments'];
    connectorRefs?: string[];
    recentTurns?: CreateTaskDto['recentTurns'];
    relatedHistory?: CreateTaskDto['relatedHistory'];
  }) => ChatRouteRecord;
  runDispatchStage: (...args: any[]) => Promise<any>;
  runGoalIntakeStage: (...args: any[]) => Promise<any>;
  runManagerPlanStage: (...args: any[]) => Promise<any>;
  runRouteStage: (...args: any[]) => Promise<any>;
  buildDataReportContract: (goal: string, context?: string) => DataReportContract;
  appendDataReportContext: (taskContext: string | undefined, contract: DataReportContract) => string;
}

let configuredRuntimeAgentDependencies: RuntimeAgentDependencies | undefined;

export function configureRuntimeAgentDependencies(dependencies: RuntimeAgentDependencies): void {
  configuredRuntimeAgentDependencies = dependencies;
}

export function getRuntimeAgentDependencies(): RuntimeAgentDependencies {
  if (!configuredRuntimeAgentDependencies) {
    throw new Error(
      'Runtime agent dependencies are not configured. Use @agent/platform-runtime or supply agentDependencies when creating AgentRuntime.'
    );
  }

  return configuredRuntimeAgentDependencies;
}
