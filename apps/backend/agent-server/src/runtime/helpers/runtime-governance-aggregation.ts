import type { CapabilityGovernanceProfileRecord, GovernanceProfileRecord } from '@agent/core';

interface CapabilityGovernanceTaskLike {
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

interface NamedGovernanceTaskLike {
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
}

function toCritiqueStyleReviewDecision(
  decision: NonNullable<NonNullable<NamedGovernanceTaskLike['governanceReport']>['reviewOutcome']['decision']>
): 'pass' | 'revise_required' | 'block' | 'needs_human_approval' {
  if (decision === 'blocked') {
    return 'block';
  }
  if (decision === 'approved' || decision === 'retry') {
    return 'pass';
  }
  return decision;
}

export function aggregateCapabilityGovernanceProfiles(
  tasks: CapabilityGovernanceTaskLike[],
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

export function aggregateNamedGovernanceProfiles(
  tasks: NamedGovernanceTaskLike[],
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
    if (!task.governanceReport.reviewOutcome.decision) {
      continue;
    }

    const entityId =
      kind === 'ministry' ? task.currentMinistry : kind === 'worker' ? task.currentWorker : task.specialistLead?.domain;
    if (!entityId) {
      continue;
    }

    const current = profileMap.get(entityId);
    const reviewDecision = toCritiqueStyleReviewDecision(task.governanceReport.reviewOutcome.decision);
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

function maxIso(left: string | undefined, right: string | undefined) {
  if (!left) {
    return right ?? new Date().toISOString();
  }
  if (!right) {
    return left;
  }
  return left > right ? left : right;
}
