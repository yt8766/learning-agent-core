import { NotFoundException } from '@nestjs/common';
import {
  appendGovernanceAudit,
  listActiveApprovalScopePolicies,
  revokeApprovalScopePolicyWithAudit
} from '@agent/runtime';
import {
  getCounselorSelectorConfigs as loadCounselorSelectorConfigs,
  setCounselorSelectorEnabled as persistCounselorSelectorEnabled,
  upsertCounselorSelectorConfig as persistCounselorSelectorConfig
} from './runtime-centers-governance-counselors';
import type { RuntimeCentersContext } from './runtime-centers.types';

export async function listApprovalScopePolicies(ctx: RuntimeCentersContext) {
  return listActiveApprovalScopePolicies(ctx.runtimeStateRepository);
}

export async function revokeApprovalScopePolicy(ctx: RuntimeCentersContext, policyId: string) {
  const revoked = await revokeApprovalScopePolicyWithAudit(ctx.runtimeStateRepository, policyId, 'agent-admin-user');
  if (!revoked) {
    throw new NotFoundException(`Approval policy ${policyId} not found`);
  }
  return revoked;
}

export async function getCounselorSelectorConfigs(ctx: RuntimeCentersContext) {
  return loadCounselorSelectorConfigs(ctx.runtimeStateRepository);
}

export async function upsertCounselorSelectorConfig(
  ctx: RuntimeCentersContext,
  input: Parameters<typeof persistCounselorSelectorConfig>[1]
) {
  return persistCounselorSelectorConfig(ctx.runtimeStateRepository, input);
}

export async function setCounselorSelectorEnabled(ctx: RuntimeCentersContext, selectorId: string, enabled: boolean) {
  return persistCounselorSelectorEnabled(ctx.runtimeStateRepository, selectorId, enabled);
}

export async function setLearningConflictStatus(
  ctx: RuntimeCentersContext,
  conflictId: string,
  status: 'open' | 'merged' | 'dismissed' | 'escalated',
  preferredMemoryId?: string
) {
  const updated = await ctx.orchestrator.updateLearningConflictStatus?.(conflictId, status, preferredMemoryId);
  await appendGovernanceAudit(ctx.runtimeStateRepository, {
    actor: 'agent-admin-user',
    action: `learning-conflict.${status}`,
    scope: 'learning-conflict',
    targetId: conflictId,
    outcome: updated ? 'success' : 'rejected',
    reason: preferredMemoryId
  });
  if (!updated) {
    throw new NotFoundException(`Learning conflict ${conflictId} not found`);
  }
  return updated;
}
