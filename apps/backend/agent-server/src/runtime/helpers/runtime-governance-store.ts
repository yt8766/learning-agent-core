import { RuntimeStateSnapshot } from '@agent/memory';
import { CapabilityGovernanceProfileRecord, GovernanceProfileRecord, TaskRecord } from '@agent/shared';
import { McpClientManager } from '@agent/tools';

import { defaultConnectorSessionState } from './runtime-derived-records';

type GovernanceAuditEntry = {
  actor: string;
  action: string;
  scope: 'skill-source' | 'company-worker' | 'skill-install' | 'connector' | 'counselor-selector' | 'learning-conflict';
  targetId: string;
  outcome: 'success' | 'rejected' | 'pending';
  reason?: string;
};

type DiscoveryRecord = NonNullable<
  NonNullable<RuntimeStateSnapshot['governance']>['connectorDiscoveryHistory']
>[number];

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
  tasks: TaskRecord[]
) {
  const snapshot = await runtimeStateRepository.load();
  const aggregated = aggregateCapabilityGovernanceProfiles(
    tasks,
    snapshot.governance?.capabilityGovernanceProfiles ?? []
  );
  const previous = snapshot.governance?.capabilityGovernanceProfiles ?? [];
  const ministryProfiles = aggregateNamedGovernanceProfiles(
    tasks,
    'ministry',
    snapshot.governance?.ministryGovernanceProfiles ?? []
  );
  const workerProfiles = aggregateNamedGovernanceProfiles(
    tasks,
    'worker',
    snapshot.governance?.workerGovernanceProfiles ?? []
  );
  const specialistProfiles = aggregateNamedGovernanceProfiles(
    tasks,
    'specialist',
    snapshot.governance?.specialistGovernanceProfiles ?? []
  );
  const previousMinistryProfiles = snapshot.governance?.ministryGovernanceProfiles ?? [];
  const previousWorkerProfiles = snapshot.governance?.workerGovernanceProfiles ?? [];
  const previousSpecialistProfiles = snapshot.governance?.specialistGovernanceProfiles ?? [];

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
  return snapshot.governance?.capabilityGovernanceProfiles ?? [];
}

export async function listGovernanceProfiles(
  runtimeStateRepository: {
    load: () => Promise<RuntimeStateSnapshot>;
  },
  kind: GovernanceProfileRecord['entityKind']
) {
  const snapshot = await runtimeStateRepository.load();
  if (kind === 'ministry') {
    return snapshot.governance?.ministryGovernanceProfiles ?? [];
  }
  if (kind === 'worker') {
    return snapshot.governance?.workerGovernanceProfiles ?? [];
  }
  return snapshot.governance?.specialistGovernanceProfiles ?? [];
}

function aggregateCapabilityGovernanceProfiles(
  tasks: TaskRecord[],
  persistedProfiles: CapabilityGovernanceProfileRecord[]
): CapabilityGovernanceProfileRecord[] {
  const profileMap = new Map<string, CapabilityGovernanceProfileRecord>(
    persistedProfiles.map(profile => [profile.capabilityId, profile])
  );

  for (const task of tasks) {
    for (const attachment of task.capabilityAttachments ?? []) {
      const governanceProfile = attachment.governanceProfile;
      if (!governanceProfile) {
        continue;
      }

      const current = profileMap.get(attachment.id);
      const recentOutcomes = mergeRecentOutcomes(current?.recentOutcomes ?? [], governanceProfile.recentOutcomes ?? []);
      const reportCount = Math.max(current?.reportCount ?? 0, governanceProfile.reportCount ?? 0);

      profileMap.set(attachment.id, {
        capabilityId: attachment.id,
        displayName: attachment.displayName,
        ownerType: attachment.owner.ownerType,
        kind: attachment.kind,
        trustLevel: attachment.capabilityTrust?.trustLevel ?? current?.trustLevel ?? 'medium',
        trustTrend: attachment.capabilityTrust?.trustTrend ?? current?.trustTrend ?? 'steady',
        reportCount,
        promoteCount: Math.max(current?.promoteCount ?? 0, governanceProfile.promoteCount ?? 0),
        holdCount: Math.max(current?.holdCount ?? 0, governanceProfile.holdCount ?? 0),
        downgradeCount: Math.max(current?.downgradeCount ?? 0, governanceProfile.downgradeCount ?? 0),
        passCount: Math.max(current?.passCount ?? 0, governanceProfile.passCount ?? 0),
        reviseRequiredCount: Math.max(current?.reviseRequiredCount ?? 0, governanceProfile.reviseRequiredCount ?? 0),
        blockCount: Math.max(current?.blockCount ?? 0, governanceProfile.blockCount ?? 0),
        lastTaskId: governanceProfile.lastTaskId ?? current?.lastTaskId,
        lastReviewDecision: governanceProfile.lastReviewDecision ?? current?.lastReviewDecision,
        lastTrustAdjustment: governanceProfile.lastTrustAdjustment ?? current?.lastTrustAdjustment,
        lastReason: attachment.capabilityTrust?.lastReason ?? current?.lastReason,
        lastGovernanceSummary: attachment.capabilityTrust?.lastGovernanceSummary ?? current?.lastGovernanceSummary,
        recentOutcomes,
        updatedAt: maxIso(current?.updatedAt, governanceProfile.updatedAt)
      });
    }
  }

  return Array.from(profileMap.values()).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

function mergeRecentOutcomes(
  left: NonNullable<CapabilityGovernanceProfileRecord['recentOutcomes']>,
  right: NonNullable<CapabilityGovernanceProfileRecord['recentOutcomes']>
) {
  const merged = new Map<string, NonNullable<CapabilityGovernanceProfileRecord['recentOutcomes']>[number]>();
  for (const item of [...left, ...right]) {
    const current = merged.get(item.taskId);
    if (!current || item.updatedAt > current.updatedAt) {
      merged.set(item.taskId, item);
    }
  }
  return Array.from(merged.values())
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 8);
}

function aggregateNamedGovernanceProfiles(
  tasks: TaskRecord[],
  kind: GovernanceProfileRecord['entityKind'],
  persistedProfiles: GovernanceProfileRecord[]
): GovernanceProfileRecord[] {
  const profileMap = new Map<string, GovernanceProfileRecord>(
    persistedProfiles.map(profile => [profile.entityId, profile])
  );

  for (const task of tasks) {
    if (!task.governanceReport) {
      continue;
    }

    const entityId =
      kind === 'ministry' ? task.currentMinistry : kind === 'worker' ? task.currentWorker : task.specialistLead?.domain;
    if (!entityId) {
      continue;
    }

    const current = profileMap.get(entityId);
    const reviewDecision = task.governanceReport.reviewOutcome.decision;
    const trustAdjustment = task.governanceReport.trustAdjustment;
    const updatedAt = task.governanceReport.updatedAt;
    const recentOutcomes = mergeRecentOutcomes(current?.recentOutcomes ?? [], [
      {
        taskId: task.id,
        reviewDecision,
        trustAdjustment,
        updatedAt
      }
    ]);
    const alreadyRecorded = current?.lastTaskId === task.id;

    profileMap.set(entityId, {
      entityId,
      displayName:
        kind === 'specialist'
          ? (task.specialistLead?.displayName ?? entityId)
          : kind === 'worker'
            ? (task.currentWorker ?? entityId)
            : (task.currentMinistry ?? entityId),
      entityKind: kind,
      trustLevel:
        trustAdjustment === 'promote'
          ? 'high'
          : trustAdjustment === 'downgrade'
            ? 'low'
            : (current?.trustLevel ?? 'medium'),
      trustTrend: trustAdjustment === 'promote' ? 'up' : trustAdjustment === 'downgrade' ? 'down' : 'steady',
      reportCount: (current?.reportCount ?? 0) + (alreadyRecorded ? 0 : 1),
      promoteCount: (current?.promoteCount ?? 0) + (!alreadyRecorded && trustAdjustment === 'promote' ? 1 : 0),
      holdCount: (current?.holdCount ?? 0) + (!alreadyRecorded && trustAdjustment === 'hold' ? 1 : 0),
      downgradeCount: (current?.downgradeCount ?? 0) + (!alreadyRecorded && trustAdjustment === 'downgrade' ? 1 : 0),
      passCount: (current?.passCount ?? 0) + (!alreadyRecorded && reviewDecision === 'pass' ? 1 : 0),
      reviseRequiredCount:
        (current?.reviseRequiredCount ?? 0) + (!alreadyRecorded && reviewDecision === 'revise_required' ? 1 : 0),
      blockCount: (current?.blockCount ?? 0) + (!alreadyRecorded && reviewDecision === 'block' ? 1 : 0),
      lastTaskId: task.id,
      lastReviewDecision: reviewDecision,
      lastTrustAdjustment: trustAdjustment,
      lastReason: task.governanceReport.reviewOutcome.summary,
      lastGovernanceSummary: task.governanceReport.summary,
      recentOutcomes,
      updatedAt: maxIso(current?.updatedAt, updatedAt)
    });
  }

  return Array.from(profileMap.values()).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

function maxIso(left: string | undefined, right: string | undefined) {
  if (!left) {
    return right ?? new Date().toISOString();
  }
  if (!right) {
    return left;
  }
  return left > right ? left : right;
}
