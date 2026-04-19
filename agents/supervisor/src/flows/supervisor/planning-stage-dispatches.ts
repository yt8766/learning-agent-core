import type { DispatchInstruction } from '@agent/core';

import type { SupervisorPlanningTaskLike } from './pipeline-stage-node.types';

interface SpecialistRouteHint {
  domain?: string;
  requiredCapabilities?: string[];
  agentId?: string;
  candidateAgentIds?: string[];
  selectedAgentId?: string;
  selectionSource?:
    | 'explicit-agent'
    | 'strategy-counselor'
    | 'specialist-lead'
    | 'supporting-specialist'
    | 'candidate-first';
}

function toSpecialistHint(specialist?: {
  id: string;
  domain?: string;
  requiredCapabilities?: string[];
  agentId?: string;
  candidateAgentIds?: string[];
}): SpecialistRouteHint | undefined {
  if (!specialist) {
    return undefined;
  }

  return {
    domain: specialist.domain ?? specialist.id,
    requiredCapabilities: specialist.requiredCapabilities?.length ? specialist.requiredCapabilities : undefined,
    agentId: specialist.agentId,
    candidateAgentIds: specialist.candidateAgentIds?.length ? specialist.candidateAgentIds : undefined
  };
}

function resolveDispatchSpecialistHint(
  task: SupervisorPlanningTaskLike,
  dispatch: DispatchInstruction
): SpecialistRouteHint | undefined {
  const lead = toSpecialistHint(task.specialistLead);
  const supports =
    task.supportingSpecialists
      ?.map(toSpecialistHint)
      .filter((item): item is SpecialistRouteHint => item !== undefined) ?? [];
  const reviewerSupport =
    supports.find(item => item.domain === 'risk-compliance') ??
    supports.find(item => item.agentId?.includes('reviewer')) ??
    supports[0];

  if (dispatch.kind === 'strategy') {
    const selectedAgentId =
      task.executionPlan?.selectedCounselorId ??
      task.entryDecision?.counselorSelector?.selectedCounselorId ??
      lead?.agentId ??
      lead?.candidateAgentIds?.[0];

    return {
      domain: lead?.domain,
      requiredCapabilities: lead?.requiredCapabilities,
      agentId:
        task.executionPlan?.selectedCounselorId ??
        task.entryDecision?.counselorSelector?.selectedCounselorId ??
        lead?.agentId,
      candidateAgentIds: task.executionPlan?.strategyCounselors?.length
        ? task.executionPlan.strategyCounselors
        : lead?.candidateAgentIds,
      selectedAgentId,
      selectionSource: task.executionPlan?.selectedCounselorId
        ? 'strategy-counselor'
        : task.entryDecision?.counselorSelector?.selectedCounselorId
          ? 'strategy-counselor'
          : lead?.agentId
            ? 'specialist-lead'
            : lead?.candidateAgentIds?.length
              ? 'candidate-first'
              : undefined
    };
  }

  if (dispatch.to === 'reviewer') {
    if (!reviewerSupport && !lead) {
      return undefined;
    }

    const reviewerHint = reviewerSupport ?? lead;
    return {
      ...reviewerHint,
      selectedAgentId: reviewerHint?.agentId ?? reviewerHint?.candidateAgentIds?.[0],
      selectionSource: reviewerSupport?.agentId
        ? 'supporting-specialist'
        : reviewerSupport?.candidateAgentIds?.length
          ? 'candidate-first'
          : lead?.agentId
            ? 'specialist-lead'
            : lead?.candidateAgentIds?.length
              ? 'candidate-first'
              : undefined
    };
  }

  if (dispatch.to === 'executor' || dispatch.to === 'research' || dispatch.to === 'manager') {
    const executionHint = lead ?? reviewerSupport;
    if (!executionHint) {
      return undefined;
    }

    return {
      ...executionHint,
      selectedAgentId: executionHint.agentId ?? executionHint.candidateAgentIds?.[0],
      selectionSource: lead?.agentId
        ? 'specialist-lead'
        : executionHint.candidateAgentIds?.length
          ? 'candidate-first'
          : reviewerSupport?.agentId
            ? 'supporting-specialist'
            : reviewerSupport?.candidateAgentIds?.length
              ? 'candidate-first'
              : undefined
    };
  }

  if (!lead) {
    return undefined;
  }

  return {
    ...lead,
    selectedAgentId: lead.agentId ?? lead.candidateAgentIds?.[0],
    selectionSource: lead.agentId ? 'specialist-lead' : lead.candidateAgentIds?.length ? 'candidate-first' : undefined
  };
}

export function enrichPlanningDispatches(
  task: SupervisorPlanningTaskLike,
  dispatches: DispatchInstruction[]
): DispatchInstruction[] {
  return dispatches.map(dispatch => {
    const specialistHint = resolveDispatchSpecialistHint(task, dispatch);
    if (!specialistHint) {
      return dispatch;
    }

    return {
      ...dispatch,
      specialistDomain: dispatch.specialistDomain ?? specialistHint.domain,
      requiredCapabilities: dispatch.requiredCapabilities ?? specialistHint.requiredCapabilities,
      agentId: dispatch.agentId ?? specialistHint.agentId,
      candidateAgentIds: dispatch.candidateAgentIds ?? specialistHint.candidateAgentIds,
      selectedAgentId: dispatch.selectedAgentId ?? specialistHint.selectedAgentId,
      selectionSource: dispatch.selectionSource ?? specialistHint.selectionSource
    };
  });
}
