import type { RuntimeStateSnapshot } from '@agent/memory';

import {
  appendGovernanceAudit,
  listApprovalScopePolicies,
  revokeApprovalScopePolicy
} from './runtime-governance-store';

interface RuntimeApprovalScopePolicyRepository {
  load: () => Promise<RuntimeStateSnapshot>;
  save: (snapshot: RuntimeStateSnapshot) => Promise<void>;
}

export async function listActiveApprovalScopePolicies(runtimeStateRepository: {
  load: () => Promise<RuntimeStateSnapshot>;
}) {
  return listApprovalScopePolicies(runtimeStateRepository);
}

export async function revokeApprovalScopePolicyWithAudit(
  runtimeStateRepository: RuntimeApprovalScopePolicyRepository,
  policyId: string,
  actor = 'agent-admin-user'
) {
  const revoked = await revokeApprovalScopePolicy(runtimeStateRepository, policyId, actor);
  await appendGovernanceAudit(runtimeStateRepository, {
    actor,
    action: 'approval-policy.revoked',
    scope: 'approval-policy',
    targetId: policyId,
    outcome: revoked ? 'success' : 'rejected'
  });
  return revoked;
}
