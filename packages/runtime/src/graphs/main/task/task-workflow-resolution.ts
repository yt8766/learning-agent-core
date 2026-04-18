import type { ExecutionPlanMode, RequestedExecutionHints, CreateTaskDto, SpecialistDomain } from '@agent/core';
import type { EvidenceRecord } from '@agent/core';
import { resolveSpecialistRoute, resolveWorkflowPreset, resolveWorkflowRoute } from '@agent/agents-supervisor';
import { appendDataReportContext, buildDataReportContract } from './task-architecture-helpers';

export function resolveTaskWorkflowResolution(params: {
  dto: CreateTaskDto;
  evidence: EvidenceRecord[];
  requestedMode: ExecutionPlanMode;
  capabilityAttachments?: CreateTaskDto['capabilityAttachments'];
  requestedHints?: RequestedExecutionHints;
  specialistDomain?: SpecialistDomain;
}) {
  const workflowResolution = resolveWorkflowPreset(params.dto.goal, {
    constraints: params.dto.constraints,
    context: params.dto.context
  });
  const dataReportContract =
    workflowResolution.preset.id === 'data-report'
      ? buildDataReportContract(workflowResolution.normalizedGoal, params.dto.context)
      : undefined;
  const enrichedTaskContext = dataReportContract
    ? appendDataReportContext(params.dto.context, dataReportContract)
    : params.dto.context;
  const specialistRoute = resolveSpecialistRoute({
    goal: workflowResolution.normalizedGoal,
    context: enrichedTaskContext,
    requestedHints: params.requestedHints ?? params.dto.requestedHints,
    externalSources: params.evidence,
    conversationSummary: params.dto.conversationSummary,
    recentTurns: params.dto.recentTurns,
    relatedHistory: params.dto.relatedHistory
  });
  const initialChatRoute = resolveWorkflowRoute({
    goal: workflowResolution.normalizedGoal,
    context: enrichedTaskContext,
    workflow: workflowResolution.preset,
    requestedMode: params.requestedMode,
    requestedHints: params.requestedHints ?? params.dto.requestedHints,
    capabilityAttachments: params.capabilityAttachments ?? [],
    connectorRefs: [],
    recentTurns: params.dto.recentTurns,
    relatedHistory: params.dto.relatedHistory
  });

  return {
    workflowResolution,
    dataReportContract,
    enrichedTaskContext,
    specialistRoute,
    initialChatRoute
  };
}
