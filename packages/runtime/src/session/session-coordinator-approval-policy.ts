import type { ChatSessionRecord, SessionApprovalDto } from '@agent/core';
import type { RuntimeStateRepository } from '@agent/memory';

import {
  buildApprovalScopeMatchKey,
  matchesApprovalScopePolicy,
  type ApprovalScopePolicyRecord
} from '../contracts/governance';
import type { SessionTaskLike } from './session-task.types';

export function buildApprovalScopeMatchInput(task: SessionTaskLike) {
  const interruptPayload =
    task.activeInterrupt?.payload && typeof task.activeInterrupt.payload === 'object'
      ? task.activeInterrupt.payload
      : {};
  return {
    intent: task.pendingApproval?.intent ?? task.activeInterrupt?.intent,
    toolName: task.pendingApproval?.toolName ?? task.activeInterrupt?.toolName,
    riskCode:
      (typeof (interruptPayload as Record<string, unknown>).riskCode === 'string'
        ? ((interruptPayload as Record<string, unknown>).riskCode as string)
        : undefined) ?? task.pendingApproval?.reasonCode,
    requestedBy: task.pendingApproval?.requestedBy ?? task.activeInterrupt?.requestedBy ?? task.currentMinistry,
    commandPreview:
      typeof (interruptPayload as Record<string, unknown>).commandPreview === 'string'
        ? ((interruptPayload as Record<string, unknown>).commandPreview as string)
        : undefined
  };
}

export function upsertSessionApprovalPolicy(policies: ApprovalScopePolicyRecord[], policy: ApprovalScopePolicyRecord) {
  const existingIndex = policies.findIndex(
    item => item.status === 'active' && item.scope === policy.scope && item.matchKey === policy.matchKey
  );
  if (existingIndex < 0) {
    return [policy, ...policies].slice(0, 50);
  }
  return policies.map((item, index) => (index === existingIndex ? { ...item, ...policy, id: item.id } : item));
}

export function upsertRuntimeApprovalPolicy(policies: ApprovalScopePolicyRecord[], policy: ApprovalScopePolicyRecord) {
  const existingIndex = policies.findIndex(
    item => item.status === 'active' && item.scope === policy.scope && item.matchKey === policy.matchKey
  );
  if (existingIndex < 0) {
    return [policy, ...policies].slice(0, 200);
  }
  return policies.map((item, index) => (index === existingIndex ? { ...item, ...policy, id: item.id } : item));
}

export async function findRuntimeApprovalScopePolicy(
  runtimeStateRepository: RuntimeStateRepository,
  task: SessionTaskLike
) {
  const snapshot = await runtimeStateRepository.load();
  const policies = snapshot.governance?.approvalScopePolicies ?? [];
  return policies.find(policy => matchesApprovalScopePolicy(policy, buildApprovalScopeMatchInput(task)));
}

export async function recordPolicyAutoAllow(params: {
  runtimeStateRepository: RuntimeStateRepository;
  session: ChatSessionRecord;
  policy: ApprovalScopePolicyRecord;
  task: SessionTaskLike;
}) {
  const snapshot = await params.runtimeStateRepository.load();
  snapshot.governanceAudit = [
    {
      id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      at: new Date().toISOString(),
      actor: params.policy.scope === 'session' ? 'agent-chat-session-policy' : 'agent-runtime-approval-policy',
      action: 'approval-policy.auto-allowed',
      scope: 'approval-policy' as const,
      targetId: params.policy.id,
      outcome: 'success' as const,
      reason: `${params.policy.scope}:${params.task.pendingApproval?.intent ?? params.task.activeInterrupt?.intent ?? ''}`
    },
    ...(snapshot.governanceAudit ?? [])
  ].slice(0, 50);
  if (params.policy.scope === 'always') {
    snapshot.governance = {
      ...(snapshot.governance ?? {}),
      approvalScopePolicies: (snapshot.governance?.approvalScopePolicies ?? []).map(item =>
        item.id === params.policy.id
          ? {
              ...item,
              lastMatchedAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              matchCount: (item.matchCount ?? 0) + 1
            }
          : item
      )
    };
  } else {
    params.session.approvalPolicies = {
      sessionAllowRules: (params.session.approvalPolicies?.sessionAllowRules ?? []).map(item =>
        item.id === params.policy.id
          ? {
              ...item,
              lastMatchedAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              matchCount: (item.matchCount ?? 0) + 1
            }
          : item
      )
    };
  }
  await params.runtimeStateRepository.save(snapshot);
}

export async function persistApprovalScopePolicy(params: {
  runtimeStateRepository: RuntimeStateRepository;
  session: ChatSessionRecord;
  task: SessionTaskLike | undefined;
  dto: SessionApprovalDto;
}) {
  const scope = params.dto.approvalScope;
  if (!params.task || !scope || scope === 'once') {
    return;
  }
  const matchInput = buildApprovalScopeMatchInput(params.task);
  const now = new Date().toISOString();
  const policy: ApprovalScopePolicyRecord = {
    id: `approval_policy_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    scope,
    status: 'active',
    actor: params.dto.actor,
    sourceDomain: params.task.currentMinistry ?? params.task.currentWorker,
    approvalScope: scope,
    matchKey: buildApprovalScopeMatchKey(matchInput),
    intent: matchInput.intent,
    toolName: matchInput.toolName,
    riskCode: matchInput.riskCode,
    requestedBy: matchInput.requestedBy,
    commandPreview: matchInput.commandPreview,
    createdAt: now,
    updatedAt: now,
    matchCount: 0
  };

  if (scope === 'session') {
    params.session.approvalPolicies = {
      sessionAllowRules: upsertSessionApprovalPolicy(params.session.approvalPolicies?.sessionAllowRules ?? [], policy)
    };
    return;
  }

  const snapshot = await params.runtimeStateRepository.load();
  snapshot.governance = {
    ...(snapshot.governance ?? {}),
    approvalScopePolicies: upsertRuntimeApprovalPolicy(snapshot.governance?.approvalScopePolicies ?? [], policy)
  };
  snapshot.governanceAudit = [
    {
      id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      at: now,
      actor: params.dto.actor ?? 'agent-chat-user',
      action: 'approval-policy.created',
      scope: 'approval-policy' as const,
      targetId: policy.id,
      outcome: 'success' as const,
      reason: `${policy.scope}:${policy.intent ?? ''}`
    },
    ...(snapshot.governanceAudit ?? [])
  ].slice(0, 50);
  await params.runtimeStateRepository.save(snapshot);
}
