import type { RuntimeStateSnapshot } from '@agent/memory';
import {
  CapabilityGovernanceProfileRecord,
  CapabilityGovernanceProfileRecordSchema,
  GovernanceProfileRecord,
  GovernanceProfileRecordSchema
} from '@agent/core';
import { McpClientManager } from '@agent/tools';

import { buildApprovalScopeMatchKey, type ApprovalScopePolicyRecord } from '../contracts/governance';
import {
  aggregateCapabilityGovernanceProfiles,
  aggregateNamedGovernanceProfiles
} from './runtime-governance-aggregation';

type GovernanceAuditEntry = {
  actor: string;
  action: string;
  scope:
    | 'skill-source'
    | 'company-worker'
    | 'skill-install'
    | 'connector'
    | 'counselor-selector'
    | 'learning-conflict'
    | 'approval-policy';
  targetId: string;
  outcome: 'success' | 'rejected' | 'pending';
  reason?: string;
};

type DiscoveryRecord = NonNullable<
  NonNullable<RuntimeStateSnapshot['governance']>['connectorDiscoveryHistory']
>[number];

interface GovernanceStoreTaskLike {
  id: string;
  currentMinistry?: string;
  currentWorker?: string;
  specialistLead?: {
    domain?: string;
    displayName: string;
  };
  governanceReport?: {
    reviewOutcome: {
      decision?: 'pass' | 'revise_required' | 'block' | 'needs_human_approval' | 'blocked' | 'approved' | 'retry';
      summary?: string;
    };
    trustAdjustment?: 'promote' | 'hold' | 'downgrade';
    summary?: string;
    updatedAt: string;
  };
  capabilityAttachments?: Array<{
    id: string;
    displayName: string;
    owner: {
      ownerType: CapabilityGovernanceProfileRecord['ownerType'];
    };
    kind: CapabilityGovernanceProfileRecord['kind'];
    capabilityTrust?: {
      trustLevel?: 'high' | 'medium' | 'low';
      trustTrend?: 'up' | 'steady' | 'down';
      lastReason?: string;
      lastGovernanceSummary?: string;
    };
    governanceProfile?: Partial<CapabilityGovernanceProfileRecord> & {
      updatedAt: string;
    };
  }>;
}

function defaultConnectorSessionState(transport?: 'http' | 'stdio' | 'local-adapter') {
  if (transport === 'stdio') {
    return 'disconnected' as const;
  }
  return 'stateless' as const;
}

export function toConnectorDiscoveryHistoryRecord(
  connectorId: string,
  connector:
    | (ReturnType<McpClientManager['describeServers']>[number] & {
        capabilities?: Array<{ toolName: string }>;
      })
    | undefined,
  error?: string
): DiscoveryRecord {
  const discoveredAt = connector?.lastDiscoveredAt ?? new Date().toISOString();
  const discoveredCapabilities =
    connector?.discoveredCapabilities ?? connector?.capabilities?.map(capability => capability.toolName) ?? [];
  return {
    connectorId,
    discoveredAt,
    discoveryMode: connector?.discoveryMode ?? 'registered',
    sessionState:
      connector?.sessionState ??
      defaultConnectorSessionState(connector?.transport as 'http' | 'stdio' | 'local-adapter' | undefined),
    discoveredCapabilities,
    error: error ?? connector?.lastDiscoveryError
  };
}

export async function persistConnectorDiscoverySnapshot(
  runtimeStateRepository: {
    load: () => Promise<RuntimeStateSnapshot>;
    save: (snapshot: RuntimeStateSnapshot) => Promise<void>;
  },
  mcpClientManager: Pick<McpClientManager, 'describeServers'>,
  connectorId: string,
  error?: unknown
) {
  const snapshot = await runtimeStateRepository.load();
  const connector = mcpClientManager.describeServers().find(item => item.id === connectorId);
  const record = toConnectorDiscoveryHistoryRecord(
    connectorId,
    connector,
    error instanceof Error ? error.message : error ? String(error) : undefined
  );
  const nextHistory = [
    record,
    ...(snapshot.governance?.connectorDiscoveryHistory ?? []).filter(
      item => !(item.connectorId === connectorId && item.discoveredAt === record.discoveredAt)
    )
  ].slice(0, 40);
  snapshot.governance = {
    ...(snapshot.governance ?? {}),
    connectorDiscoveryHistory: nextHistory
  };
  await runtimeStateRepository.save(snapshot);
}

export async function appendGovernanceAudit(
  runtimeStateRepository: {
    load: () => Promise<RuntimeStateSnapshot>;
    save: (snapshot: RuntimeStateSnapshot) => Promise<void>;
  },
  entry: GovernanceAuditEntry
) {
  const snapshot = await runtimeStateRepository.load();
  snapshot.governanceAudit = [
    {
      id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      at: new Date().toISOString(),
      ...entry
    },
    ...(snapshot.governanceAudit ?? [])
  ].slice(0, 50);
  await runtimeStateRepository.save(snapshot);
}

export async function getRecentGovernanceAudit(runtimeStateRepository: { load: () => Promise<RuntimeStateSnapshot> }) {
  const snapshot = await runtimeStateRepository.load();
  return (snapshot.governanceAudit ?? []).slice(0, 10);
}

export async function syncCapabilityGovernanceProfiles(
  runtimeStateRepository: {
    load: () => Promise<RuntimeStateSnapshot>;
    save: (snapshot: RuntimeStateSnapshot) => Promise<void>;
  },
  tasks: GovernanceStoreTaskLike[]
) {
  const snapshot = await runtimeStateRepository.load();
  const aggregated = aggregateCapabilityGovernanceProfiles(tasks, getCapabilityGovernanceProfiles(snapshot));
  const previous = getCapabilityGovernanceProfiles(snapshot);
  const ministryProfiles = aggregateNamedGovernanceProfiles(
    tasks,
    'ministry',
    getGovernanceProfiles(snapshot, 'ministry')
  );
  const workerProfiles = aggregateNamedGovernanceProfiles(tasks, 'worker', getGovernanceProfiles(snapshot, 'worker'));
  const specialistProfiles = aggregateNamedGovernanceProfiles(
    tasks,
    'specialist',
    getGovernanceProfiles(snapshot, 'specialist')
  );
  const previousMinistryProfiles = getGovernanceProfiles(snapshot, 'ministry');
  const previousWorkerProfiles = getGovernanceProfiles(snapshot, 'worker');
  const previousSpecialistProfiles = getGovernanceProfiles(snapshot, 'specialist');

  if (
    JSON.stringify(previous) !== JSON.stringify(aggregated) ||
    JSON.stringify(previousMinistryProfiles) !== JSON.stringify(ministryProfiles) ||
    JSON.stringify(previousWorkerProfiles) !== JSON.stringify(workerProfiles) ||
    JSON.stringify(previousSpecialistProfiles) !== JSON.stringify(specialistProfiles)
  ) {
    snapshot.governance = {
      ...(snapshot.governance ?? {}),
      capabilityGovernanceProfiles: aggregated,
      ministryGovernanceProfiles: ministryProfiles,
      workerGovernanceProfiles: workerProfiles,
      specialistGovernanceProfiles: specialistProfiles
    };
    await runtimeStateRepository.save(snapshot);
  }

  return aggregated;
}

export async function listCapabilityGovernanceProfiles(runtimeStateRepository: {
  load: () => Promise<RuntimeStateSnapshot>;
}) {
  const snapshot = await runtimeStateRepository.load();
  return getCapabilityGovernanceProfiles(snapshot);
}

export async function listGovernanceProfiles(
  runtimeStateRepository: {
    load: () => Promise<RuntimeStateSnapshot>;
  },
  kind: GovernanceProfileRecord['entityKind']
) {
  const snapshot = await runtimeStateRepository.load();
  return getGovernanceProfiles(snapshot, kind);
}

export function getCapabilityGovernanceProfiles(snapshot: RuntimeStateSnapshot): CapabilityGovernanceProfileRecord[] {
  return (snapshot.governance?.capabilityGovernanceProfiles ?? [])
    .map(item => CapabilityGovernanceProfileRecordSchema.safeParse(item))
    .filter((result): result is { success: true; data: CapabilityGovernanceProfileRecord } => result.success)
    .map(result => result.data);
}

export function getGovernanceProfiles(
  snapshot: RuntimeStateSnapshot,
  kind: GovernanceProfileRecord['entityKind']
): GovernanceProfileRecord[] {
  const records =
    kind === 'ministry'
      ? snapshot.governance?.ministryGovernanceProfiles
      : kind === 'worker'
        ? snapshot.governance?.workerGovernanceProfiles
        : snapshot.governance?.specialistGovernanceProfiles;
  return (records ?? [])
    .map(item => GovernanceProfileRecordSchema.safeParse(item))
    .filter((result): result is { success: true; data: GovernanceProfileRecord } => result.success)
    .map(result => result.data);
}

export async function listApprovalScopePolicies(runtimeStateRepository: { load: () => Promise<RuntimeStateSnapshot> }) {
  const snapshot = await runtimeStateRepository.load();
  return (snapshot.governance?.approvalScopePolicies ?? [])
    .filter(policy => policy.status === 'active')
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export async function upsertApprovalScopePolicy(
  runtimeStateRepository: {
    load: () => Promise<RuntimeStateSnapshot>;
    save: (snapshot: RuntimeStateSnapshot) => Promise<void>;
  },
  input: Omit<
    ApprovalScopePolicyRecord,
    'id' | 'createdAt' | 'updatedAt' | 'matchKey' | 'matchCount' | 'lastMatchedAt'
  > & {
    id?: string;
  }
) {
  const snapshot = await runtimeStateRepository.load();
  const policies = [...(snapshot.governance?.approvalScopePolicies ?? [])];
  const now = new Date().toISOString();
  const matchKey = buildApprovalScopeMatchKey(input);
  const existingIndex = policies.findIndex(
    policy => policy.status === 'active' && policy.scope === input.scope && policy.matchKey === matchKey
  );
  const existing = existingIndex >= 0 ? policies[existingIndex] : undefined;
  const policy: ApprovalScopePolicyRecord = {
    id: existing?.id ?? input.id ?? `approval_policy_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    status: input.status,
    scope: input.scope,
    actor: input.actor,
    sourceDomain: input.sourceDomain,
    intent: input.intent,
    toolName: input.toolName,
    riskCode: input.riskCode,
    requestedBy: input.requestedBy,
    commandPreview: input.commandPreview,
    approvalScope: input.approvalScope ?? input.scope,
    matchKey,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    revokedAt: input.revokedAt,
    revokedBy: input.revokedBy,
    lastMatchedAt: existing?.lastMatchedAt,
    matchCount: existing?.matchCount ?? 0
  };

  if (existingIndex >= 0) {
    policies.splice(existingIndex, 1, policy);
  } else {
    policies.unshift(policy);
  }

  snapshot.governance = {
    ...(snapshot.governance ?? {}),
    approvalScopePolicies: policies.slice(0, 200)
  };
  await runtimeStateRepository.save(snapshot);
  return policy;
}

export async function revokeApprovalScopePolicy(
  runtimeStateRepository: {
    load: () => Promise<RuntimeStateSnapshot>;
    save: (snapshot: RuntimeStateSnapshot) => Promise<void>;
  },
  policyId: string,
  actor: string
) {
  const snapshot = await runtimeStateRepository.load();
  const policies = [...(snapshot.governance?.approvalScopePolicies ?? [])];
  const index = policies.findIndex(policy => policy.id === policyId);
  if (index < 0) {
    return undefined;
  }
  const current = policies[index]!;
  const next: ApprovalScopePolicyRecord = {
    ...current,
    status: 'revoked',
    revokedAt: new Date().toISOString(),
    revokedBy: actor,
    updatedAt: new Date().toISOString()
  };
  policies.splice(index, 1, next);
  snapshot.governance = {
    ...(snapshot.governance ?? {}),
    approvalScopePolicies: policies
  };
  await runtimeStateRepository.save(snapshot);
  return next;
}

export async function recordApprovalScopePolicyMatch(
  runtimeStateRepository: {
    load: () => Promise<RuntimeStateSnapshot>;
    save: (snapshot: RuntimeStateSnapshot) => Promise<void>;
  },
  policyId: string
) {
  const snapshot = await runtimeStateRepository.load();
  const policies = [...(snapshot.governance?.approvalScopePolicies ?? [])];
  const index = policies.findIndex(policy => policy.id === policyId);
  if (index < 0) {
    return undefined;
  }
  const current = policies[index]!;
  const next: ApprovalScopePolicyRecord = {
    ...current,
    lastMatchedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    matchCount: (current.matchCount ?? 0) + 1
  };
  policies.splice(index, 1, next);
  snapshot.governance = {
    ...(snapshot.governance ?? {}),
    approvalScopePolicies: policies
  };
  await runtimeStateRepository.save(snapshot);
  return next;
}
