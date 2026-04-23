import type { PreprocessDecision } from '@agent/core';

import type { ModelInvocationPreprocessor } from '../model-invocation.types';

const toStringList = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === 'string')
        .map(item => item.trim())
        .filter(item => item.length > 0)
    )
  );
};

export const capabilityInjectionPreprocessor: ModelInvocationPreprocessor = {
  name: 'capability-injection',
  run(decision, context): PreprocessDecision {
    const selectedSkills = toStringList(context.request.capabilityHints.skills);
    const selectedTools = toStringList(context.request.capabilityHints.tools);
    const requestedMcpCapabilities = toStringList(context.request.capabilityHints.mcp);

    if (selectedSkills.length === 0 && selectedTools.length === 0 && requestedMcpCapabilities.length === 0) {
      return decision;
    }

    if (context.request.modeProfile === 'direct-reply') {
      const rejectedCandidates = [...selectedSkills, ...selectedTools, ...requestedMcpCapabilities];

      return {
        ...decision,
        allowExecution: false,
        denyReason: 'direct-reply mode rejected requested capability hints',
        capabilityInjectionPlan: {
          ...decision.capabilityInjectionPlan,
          rejectedCandidates: Array.from(
            new Set([...decision.capabilityInjectionPlan.rejectedCandidates, ...rejectedCandidates])
          ),
          reasons: Array.from(
            new Set([
              ...decision.capabilityInjectionPlan.reasons,
              'direct-reply mode does not permit capability injection'
            ])
          )
        }
      };
    }

    if (context.request.modeProfile !== 'runtime-task') {
      return decision;
    }

    return {
      ...decision,
      capabilityInjectionPlan: {
        ...decision.capabilityInjectionPlan,
        selectedSkills: Array.from(new Set([...decision.capabilityInjectionPlan.selectedSkills, ...selectedSkills])),
        selectedTools: Array.from(new Set([...decision.capabilityInjectionPlan.selectedTools, ...selectedTools])),
        selectedMcpCapabilities: Array.from(
          new Set([...decision.capabilityInjectionPlan.selectedMcpCapabilities, ...requestedMcpCapabilities])
        )
      }
    };
  }
};
