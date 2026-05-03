import { AgentRuntimeTaskProjectionSchema, ContextManifestSchema } from '@agent/core';
import type {
  AgentRuntimeTaskProjection,
  ContextManifest,
  GovernancePhase,
  PolicyDecision,
  QualityGateResult
} from '@agent/core';

export interface RuntimeProjectionSideEffectInput {
  reversible: boolean;
  compensated: boolean;
}

export interface BuildAgentRuntimeTaskProjectionInput {
  taskId: string;
  currentAgentId?: string;
  governancePhase: GovernancePhase;
  selectedProfileId?: string;
  contextManifest?: ContextManifest;
  latestPolicyDecision?: PolicyDecision;
  pendingInterruptId?: string;
  qualityGateResults?: QualityGateResult[];
  evidenceRefs?: string[];
  budgetSummary?: AgentRuntimeTaskProjection['budgetSummary'];
  sideEffects?: RuntimeProjectionSideEffectInput[];
}

export function buildAgentRuntimeTaskProjection(
  input: BuildAgentRuntimeTaskProjectionInput
): AgentRuntimeTaskProjection {
  const contextManifest = input.contextManifest ? ContextManifestSchema.parse(input.contextManifest) : undefined;

  return AgentRuntimeTaskProjectionSchema.parse({
    taskId: input.taskId,
    currentAgentId: input.currentAgentId,
    governancePhase: input.governancePhase,
    selectedProfileId: input.selectedProfileId,
    contextManifestSummary: contextManifest
      ? {
          bundleId: contextManifest.bundleId,
          loadedPageCount: contextManifest.loadedPages.length,
          omittedPageCount: contextManifest.omittedPages.length,
          totalTokenCost: contextManifest.totalTokenCost
        }
      : undefined,
    latestPolicyDecision: input.latestPolicyDecision,
    pendingInterruptId: input.pendingInterruptId,
    qualityGateResults: input.qualityGateResults ?? [],
    evidenceRefs: input.evidenceRefs ?? [],
    budgetSummary: input.budgetSummary,
    sideEffectSummary: input.sideEffects
      ? {
          total: input.sideEffects.length,
          reversible: input.sideEffects.filter(effect => effect.reversible).length,
          compensated: input.sideEffects.filter(effect => effect.compensated).length
        }
      : undefined
  });
}
