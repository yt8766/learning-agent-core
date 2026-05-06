import { z } from 'zod';
import { QualityGateResultSchema } from './agent-runtime-quality';
import { PolicyDecisionSchema } from './agent-runtime-syscall';

export const GovernancePhaseSchema = z.enum([
  'context_loading',
  'agent_running',
  'policy_checking',
  'waiting_context',
  'waiting_approval',
  'tool_executing',
  'quality_checking',
  'delivering'
]);

export const AgentRuntimeTaskProjectionSchema = z.object({
  taskId: z.string().min(1),
  currentAgentId: z.string().min(1).optional(),
  governancePhase: GovernancePhaseSchema,
  selectedProfileId: z.string().min(1).optional(),
  contextManifestSummary: z
    .object({
      bundleId: z.string().min(1),
      loadedPageCount: z.number().int().nonnegative(),
      omittedPageCount: z.number().int().nonnegative(),
      totalTokenCost: z.number().int().nonnegative()
    })
    .optional(),
  latestPolicyDecision: PolicyDecisionSchema.optional(),
  pendingInterruptId: z.string().min(1).optional(),
  qualityGateResults: z.array(QualityGateResultSchema).default([]),
  evidenceRefs: z.array(z.string().min(1)).default([]),
  budgetSummary: z
    .object({
      tokenBudget: z.number().int().nonnegative(),
      tokensUsed: z.number().int().nonnegative(),
      costBudgetUsd: z.number().nonnegative(),
      costUsedUsd: z.number().nonnegative()
    })
    .optional(),
  sideEffectSummary: z
    .object({
      total: z.number().int().nonnegative(),
      reversible: z.number().int().nonnegative(),
      compensated: z.number().int().nonnegative()
    })
    .optional()
});
