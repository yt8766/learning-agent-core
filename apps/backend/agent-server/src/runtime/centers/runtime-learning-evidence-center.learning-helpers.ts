interface LearningCenterTaskLike {
  id: string;
  goal: string;
  status?: string;
  interruptHistory?: unknown[];
  executionPlan?: {
    selectedCounselorId?: string;
    selectedVersion?: string;
  };
  entryDecision?: {
    counselorSelector?: {
      selectedCounselorId?: string;
      selectedVersion?: string;
    };
  };
  critiqueResult?: {
    decision?: string;
  };
  llmUsage?: {
    totalTokens?: number;
  };
  budgetState?: {
    costConsumedUsd?: number;
  };
  capabilityAttachments?: Array<{
    id: string;
    displayName: string;
    capabilityTrust?: {
      trustLevel?: 'high' | 'medium' | 'low';
      trustTrend?: 'up' | 'steady' | 'down';
      lastReason?: string;
      updatedAt?: string;
    };
    governanceProfile?: {
      reportCount?: number;
      promoteCount?: number;
      holdCount?: number;
      downgradeCount?: number;
      lastTaskId?: string;
      lastReviewDecision?: 'pass' | 'revise_required' | 'block' | 'needs_human_approval';
      updatedAt?: string;
    };
    updatedAt?: string;
  }>;
}

export function queuePriorityScore(priority?: string) {
  return priority === 'high' ? 2 : 1;
}

export function summarizeCounselorExperiments(
  tasks: LearningCenterTaskLike[],
  learningQueue: Array<{
    taskId: string;
    selectedCounselorId?: string;
    selectedVersion?: string;
    capabilityUsageStats?: {
      totalTokens?: number;
      totalCostUsd?: number;
    };
  }>
) {
  const queueByTask = new Map(learningQueue.map(item => [item.taskId, item]));
  const grouped = new Map<string, any>();
  for (const task of tasks) {
    const queueItem = queueByTask.get(task.id);
    const selectedCounselorId =
      task.executionPlan?.selectedCounselorId ??
      task.entryDecision?.counselorSelector?.selectedCounselorId ??
      queueItem?.selectedCounselorId;
    const selectedVersion =
      task.executionPlan?.selectedVersion ??
      task.entryDecision?.counselorSelector?.selectedVersion ??
      queueItem?.selectedVersion ??
      'unversioned';
    if (!selectedCounselorId) {
      continue;
    }
    const key = `${selectedCounselorId}:${selectedVersion}`;
    const current = grouped.get(key) ?? {
      selectedCounselorId,
      selectedVersion,
      taskCount: 0,
      successCount: 0,
      interruptCount: 0,
      blockedCount: 0,
      totalTokens: 0,
      totalCostUsd: 0
    };
    current.taskCount += 1;
    current.successCount += task.status === 'completed' ? 1 : 0;
    current.interruptCount += task.interruptHistory?.length ?? 0;
    current.blockedCount += task.critiqueResult?.decision === 'block' ? 1 : 0;
    current.totalTokens += queueItem?.capabilityUsageStats?.totalTokens ?? task.llmUsage?.totalTokens ?? 0;
    current.totalCostUsd += queueItem?.capabilityUsageStats?.totalCostUsd ?? task.budgetState?.costConsumedUsd ?? 0;
    grouped.set(key, current);
  }
  return Array.from(grouped.values())
    .map(item => ({
      selectedCounselorId: item.selectedCounselorId,
      selectedVersion: item.selectedVersion,
      taskCount: item.taskCount,
      successRate: item.taskCount > 0 ? item.successCount / item.taskCount : 0,
      interruptRate: item.taskCount > 0 ? item.interruptCount / item.taskCount : 0,
      blockedRate: item.taskCount > 0 ? item.blockedCount / item.taskCount : 0,
      avgTokens: item.taskCount > 0 ? item.totalTokens / item.taskCount : 0,
      avgCostUsd: item.taskCount > 0 ? item.totalCostUsd / item.taskCount : 0
    }))
    .sort((left, right) => right.taskCount - left.taskCount)
    .slice(0, 12);
}

export function toGovernanceProfileSummary(profile: {
  entityId: string;
  displayName: string;
  entityKind: 'ministry' | 'worker' | 'specialist';
  trustLevel: 'high' | 'medium' | 'low';
  trustTrend: 'up' | 'steady' | 'down';
  lastReason?: string;
  reportCount: number;
  promoteCount: number;
  holdCount: number;
  downgradeCount: number;
  lastTaskId?: string;
  lastReviewDecision?: 'pass' | 'revise_required' | 'block' | 'needs_human_approval';
  updatedAt: string;
}) {
  return {
    entityId: profile.entityId,
    displayName: profile.displayName,
    entityKind: profile.entityKind,
    trustLevel: profile.trustLevel,
    trustTrend: profile.trustTrend,
    lastReason: profile.lastReason,
    reportCount: profile.reportCount,
    promoteCount: profile.promoteCount,
    holdCount: profile.holdCount,
    downgradeCount: profile.downgradeCount,
    lastTaskId: profile.lastTaskId,
    lastReviewDecision: profile.lastReviewDecision,
    updatedAt: profile.updatedAt
  };
}

export function buildCapabilityTrustProfiles(
  tasks: LearningCenterTaskLike[],
  persistedCapabilityProfiles: Array<{
    capabilityId: string;
    displayName: string;
    trustLevel: 'high' | 'medium' | 'low';
    trustTrend: 'up' | 'steady' | 'down';
    lastReason?: string;
    reportCount: number;
    promoteCount: number;
    holdCount: number;
    downgradeCount: number;
    lastTaskId?: string;
    lastReviewDecision?: 'pass' | 'revise_required' | 'block' | 'needs_human_approval';
    updatedAt: string;
  }>
) {
  const fallbackProfiles = Array.from(
    tasks
      .flatMap(task => task.capabilityAttachments ?? [])
      .reduce((acc, attachment) => {
        const current = acc.get(attachment.id);
        const next = {
          capabilityId: attachment.id,
          displayName: attachment.displayName,
          trustLevel: attachment.capabilityTrust?.trustLevel ?? 'medium',
          trustTrend: attachment.capabilityTrust?.trustTrend ?? 'steady',
          lastReason: attachment.capabilityTrust?.lastReason,
          reportCount: attachment.governanceProfile?.reportCount ?? 0,
          promoteCount: attachment.governanceProfile?.promoteCount ?? 0,
          holdCount: attachment.governanceProfile?.holdCount ?? 0,
          downgradeCount: attachment.governanceProfile?.downgradeCount ?? 0,
          lastTaskId: attachment.governanceProfile?.lastTaskId,
          lastReviewDecision: attachment.governanceProfile?.lastReviewDecision,
          updatedAt:
            attachment.governanceProfile?.updatedAt ??
            attachment.capabilityTrust?.updatedAt ??
            attachment.updatedAt ??
            new Date().toISOString()
        };
        if (!current || next.reportCount > current.reportCount || next.updatedAt > current.updatedAt) {
          acc.set(attachment.id, next);
        }
        return acc;
      }, new Map<string, any>())
      .values()
  );
  return (persistedCapabilityProfiles.length ? persistedCapabilityProfiles : fallbackProfiles)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .slice(0, 20);
}
