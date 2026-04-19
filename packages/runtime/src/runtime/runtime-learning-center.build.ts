import {
  buildCapabilityTrustProfiles,
  queuePriorityScore,
  summarizeCounselorExperiments,
  toGovernanceProfileSummary
} from './runtime-learning-center.helpers';
import type {
  BuildLearningCenterInput,
  CrossCheckEvidenceEntry,
  LocalSkillSuggestionsRecord
} from './runtime-learning-center.types';

export async function buildLearningCenter(input: BuildLearningCenterInput) {
  const learningQueue = input.learningQueue ?? [];
  const queueByMode = (mode: 'task-learning' | 'dream-task') =>
    learningQueue.filter(item => (item.mode ?? 'task-learning') === mode);
  const queueByStatus = (status: string) => learningQueue.filter(item => item.status === status);
  const queueByModeAndStatus = (mode: 'task-learning' | 'dream-task', status: string) =>
    learningQueue.filter(item => (item.mode ?? 'task-learning') === mode && item.status === status);

  const learningCandidates = input.tasks.flatMap(task =>
    (task.learningCandidates ?? []).map(candidate => ({
      ...candidate,
      taskGoal: task.goal,
      currentMinistry: task.currentMinistry,
      currentWorker: task.currentWorker,
      confidenceScore: candidate.confidenceScore,
      autoConfirmEligible: candidate.autoConfirmEligible,
      provenanceCount: candidate.provenance?.length ?? 0,
      evaluationScore: task.learningEvaluation?.score,
      evaluationConfidence: task.learningEvaluation?.confidence,
      candidateReasons: task.learningEvaluation?.candidateReasons ?? [],
      skippedReasons: task.learningEvaluation?.skippedReasons ?? [],
      conflictDetected: task.learningEvaluation?.conflictDetected,
      conflictTargets: task.learningEvaluation?.conflictTargets ?? [],
      derivedFromLayers: task.learningEvaluation?.derivedFromLayers ?? [],
      policyMode: task.learningEvaluation?.policyMode,
      expertiseSignals: task.learningEvaluation?.expertiseSignals ?? []
    }))
  );
  const ruleCandidates = input.deriveRuleCandidates?.(input.tasks) ?? [];
  const mergedCandidates = [...ruleCandidates, ...learningCandidates].sort(
    (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
  );

  const [
    wenyuanOverview,
    knowledgeOverview,
    memoryStats,
    invalidatedRules,
    crossCheckEvidence,
    localSkillSuggestions,
    governanceSnapshot,
    resolutionCandidates
  ]: [
    Awaited<NonNullable<typeof input.wenyuanOverviewPromise>> | undefined,
    Awaited<NonNullable<typeof input.knowledgeOverviewPromise>> | undefined,
    Awaited<typeof input.memoryStatsPromise>,
    number,
    CrossCheckEvidenceEntry[],
    LocalSkillSuggestionsRecord[],
    Awaited<NonNullable<typeof input.governanceSnapshotPromise>> | undefined,
    Awaited<NonNullable<typeof input.resolutionCandidatesPromise>> | undefined
  ] = await Promise.all([
    input.wenyuanOverviewPromise,
    input.knowledgeOverviewPromise,
    input.memoryStatsPromise,
    input.invalidatedRulesPromise,
    input.crossCheckEvidencePromise,
    Promise.all(
      input.tasks
        .slice()
        .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
        .slice(0, 10)
        .map(async task => ({
          taskId: task.id,
          goal: task.goal,
          ...(await input.resolveLocalSkillSuggestions(task))
        }))
    ),
    input.governanceSnapshotPromise,
    input.resolutionCandidatesPromise
  ]);

  const selectorConfigs = governanceSnapshot?.governance?.counselorSelectorConfigs ?? [];
  const learningConflictScan = governanceSnapshot?.governance?.learningConflictScan;
  const persistedCapabilityProfiles = governanceSnapshot?.governance?.capabilityGovernanceProfiles ?? [];
  const persistedMinistryProfiles = governanceSnapshot?.governance?.ministryGovernanceProfiles ?? [];
  const persistedWorkerProfiles = governanceSnapshot?.governance?.workerGovernanceProfiles ?? [];
  const persistedSpecialistProfiles = governanceSnapshot?.governance?.specialistGovernanceProfiles ?? [];

  return {
    totalCandidates: mergedCandidates.length,
    pendingCandidates: mergedCandidates.filter(candidate => candidate.status === 'pending_confirmation').length,
    confirmedCandidates: mergedCandidates.filter(candidate => candidate.status === 'confirmed').length,
    researchJobs: input.jobs.filter(job => job.sourceType === 'research').length,
    autoPersistedResearchJobs: input.jobs.filter(job => (job.persistedMemoryIds?.length ?? 0) > 0).length,
    conflictingResearchJobs: input.jobs.filter(job => job.conflictDetected).length,
    invalidatedMemories: memoryStats.invalidated,
    quarantinedMemories: memoryStats.quarantined,
    invalidatedRules,
    quarantineCategoryStats: memoryStats.recentQuarantined.reduce(
      (acc, item) => {
        const key = item.quarantineCategory ?? 'uncategorized';
        acc[key] = (acc[key] ?? 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    ),
    quarantineRestoreSuggestions: Array.from(
      new Set(memoryStats.recentQuarantined.map(item => item.quarantineRestoreSuggestion).filter(Boolean))
    ),
    recentQuarantinedMemories: memoryStats.recentQuarantined,
    recentCrossCheckEvidence: crossCheckEvidence
      .slice()
      .reverse()
      .slice(0, 12)
      .map(item => ({
        memoryId: item.memoryId,
        id: item.record.id,
        summary: item.record.summary,
        sourceType: item.record.sourceType,
        trustClass: item.record.trustClass ?? 'unknown'
      })),
    recentJobs: input.jobs
      .slice()
      .sort((left, right) => new Date(right.updatedAt ?? '').getTime() - new Date(left.updatedAt ?? '').getTime())
      .slice(0, 10)
      .map(job => ({
        ...job,
        sourceCount: job.sources?.length ?? 0,
        evaluationScore: job.learningEvaluation?.score,
        evaluationConfidence: job.learningEvaluation?.confidence,
        candidateReasons: job.learningEvaluation?.candidateReasons ?? [],
        skippedReasons: job.learningEvaluation?.skippedReasons ?? [],
        expertiseSignals: job.learningEvaluation?.expertiseSignals ?? []
      })),
    queuedLearningTasks: input.tasks.filter(task => Boolean(task.learningQueueItemId)).length,
    learningQueue: learningQueue
      .slice()
      .sort((left, right) => {
        const priorityGap = queuePriorityScore(right.priority) - queuePriorityScore(left.priority);
        if (priorityGap !== 0) {
          return priorityGap;
        }
        return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
      })
      .slice(0, 20),
    learningQueueSummary: {
      total: learningQueue.length,
      queued: queueByStatus('queued').length,
      processing: queueByStatus('running').length,
      blocked: queueByStatus('blocked').length,
      completed: queueByStatus('completed').length,
      taskLearningQueued: queueByModeAndStatus('task-learning', 'queued').length,
      taskLearningProcessing: queueByModeAndStatus('task-learning', 'running').length,
      taskLearningCompleted: queueByModeAndStatus('task-learning', 'completed').length,
      dreamTaskQueued: queueByModeAndStatus('dream-task', 'queued').length,
      dreamTaskProcessing: queueByModeAndStatus('dream-task', 'running').length,
      dreamTaskCompleted: queueByModeAndStatus('dream-task', 'completed').length,
      byMode: {
        taskLearning: {
          total: queueByMode('task-learning').length,
          queued: queueByModeAndStatus('task-learning', 'queued').length,
          processing: queueByModeAndStatus('task-learning', 'running').length,
          blocked: queueByModeAndStatus('task-learning', 'blocked').length,
          completed: queueByModeAndStatus('task-learning', 'completed').length
        },
        dreamTask: {
          total: queueByMode('dream-task').length,
          queued: queueByModeAndStatus('dream-task', 'queued').length,
          processing: queueByModeAndStatus('dream-task', 'running').length,
          blocked: queueByModeAndStatus('dream-task', 'blocked').length,
          completed: queueByModeAndStatus('dream-task', 'completed').length
        }
      }
    },
    timeoutStats: {
      timedOutTaskCount: input.tasks.filter(task => (task.learningEvaluation?.timeoutStats?.count ?? 0) > 0).length,
      defaultAppliedCount: input.tasks.reduce(
        (sum, task) => sum + (task.learningEvaluation?.timeoutStats?.defaultAppliedCount ?? 0),
        0
      )
    },
    counselorExperiments: summarizeCounselorExperiments(input.tasks, input.learningQueue ?? []),
    counselorSelectorConfigs: selectorConfigs
      .slice()
      .sort(
        (left, right) => Number(right.enabled) - Number(left.enabled) || right.updatedAt.localeCompare(left.updatedAt)
      )
      .slice(0, 20),
    learningConflictScan: {
      scannedAt: learningConflictScan?.scannedAt,
      conflictPairs: (learningConflictScan?.conflictPairs ?? []).slice(0, 12).map(item => ({
        id: item.id,
        contextSignature: item.contextSignature,
        conflictSetId: item.conflictSetId,
        memoryIds: item.memoryIds,
        effectivenessSpread: item.effectivenessSpread ?? 0,
        recommendation: item.resolution,
        riskLevel: item.severity,
        status: item.status
      })),
      mergeSuggestions: (learningConflictScan?.mergeSuggestions ?? []).slice(0, 12),
      manualReviewQueue: (learningConflictScan?.manualReviewQueue ?? []).slice(0, 12).map(item => ({
        id: item.id,
        contextSignature: item.contextSignature,
        memoryIds: item.memoryIds,
        severity: item.severity,
        resolution: item.resolution,
        preferredMemoryId: item.preferredMemoryId,
        effectivenessSpread: item.effectivenessSpread,
        status: item.status
      }))
    },
    memoryResolutionCandidates: (resolutionCandidates ?? [])
      .slice()
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, 12)
      .map(item => ({
        id: item.id,
        conflictKind: item.conflictKind,
        challengerId: item.challengerId,
        incumbentId: item.incumbentId,
        suggestedAction: item.suggestedAction,
        confidence: item.confidence,
        rationale: item.rationale,
        requiresHumanReview: item.requiresHumanReview,
        resolution: item.resolution,
        createdAt: item.createdAt
      })),
    conflictGovernance: {
      scannedAt: learningConflictScan?.scannedAt,
      openConflictCount: (learningConflictScan?.conflictPairs ?? []).filter(item => item.status !== 'resolved').length,
      manualReviewCount: learningConflictScan?.manualReviewQueue?.length ?? 0,
      mergeSuggestionCount: learningConflictScan?.mergeSuggestions?.length ?? 0
    },
    knowledgeStores: {
      wenyuan: wenyuanOverview
        ? {
            memoryCount: wenyuanOverview.memoryCount,
            sessionCount: wenyuanOverview.sessionCount,
            checkpointCount: wenyuanOverview.checkpointCount,
            traceCount: wenyuanOverview.traceCount,
            governanceHistoryCount: wenyuanOverview.governanceHistoryCount
          }
        : undefined,
      cangjing: knowledgeOverview
        ? {
            sourceCount: knowledgeOverview.sourceCount,
            chunkCount: knowledgeOverview.chunkCount,
            embeddingCount: knowledgeOverview.embeddingCount,
            searchableDocumentCount: knowledgeOverview.searchableDocumentCount,
            blockedDocumentCount: knowledgeOverview.blockedDocumentCount,
            latestReceiptIds: knowledgeOverview.latestReceipts.map(item => item.id)
          }
        : undefined
    },
    capabilityTrustProfiles: buildCapabilityTrustProfiles(input.tasks, persistedCapabilityProfiles),
    ministryGovernanceProfiles: persistedMinistryProfiles
      .map(profile => toGovernanceProfileSummary({ ...profile, entityKind: 'ministry' }))
      .slice(0, 20),
    workerGovernanceProfiles: persistedWorkerProfiles
      .map(profile => toGovernanceProfileSummary({ ...profile, entityKind: 'worker' }))
      .slice(0, 20),
    specialistGovernanceProfiles: persistedSpecialistProfiles
      .map(profile => toGovernanceProfileSummary({ ...profile, entityKind: 'specialist' }))
      .slice(0, 20),
    ministryScorecards: input.tasks
      .filter(task => task.governanceReport)
      .slice(0, 20)
      .map(task => ({
        taskId: task.id,
        currentMinistry: task.currentMinistry,
        reviewDecision: task.governanceReport?.reviewOutcome?.decision,
        reviewSummary: task.governanceReport?.reviewOutcome?.summary,
        trustAdjustment: task.governanceReport?.trustAdjustment,
        evidenceScore: task.governanceReport?.evidenceSufficiency?.score,
        sandboxScore: task.governanceReport?.sandboxReliability?.score
      })),
    budgetEfficiencyWarnings: input.tasks
      .filter(task => task.budgetState?.budgetInterruptState || (task.budgetState?.costConsumedUsd ?? 0) > 5)
      .slice(0, 20)
      .map(task => ({
        taskId: task.id,
        goal: task.goal,
        costConsumedUsd: task.budgetState?.costConsumedUsd ?? 0,
        budgetInterruptState: task.budgetState?.budgetInterruptState
      })),
    autoConfirmableCandidates: mergedCandidates.filter(candidate => candidate.autoConfirmEligible).length,
    averageEvaluationScore:
      input.tasks
        .filter(task => task.learningEvaluation?.score != null)
        .reduce((sum, task) => sum + (task.learningEvaluation?.score ?? 0), 0) /
      Math.max(1, input.tasks.filter(task => task.learningEvaluation?.score != null).length),
    candidates: mergedCandidates.slice(0, 20),
    localSkillSuggestions,
    recentSkillGovernance: input.tasks
      .flatMap(task =>
        (task.learningEvaluation?.skillGovernanceRecommendations ?? []).map(item => ({
          taskId: task.id,
          goal: task.goal,
          ...item
        }))
      )
      .slice(0, 20),
    recentGovernanceReports: input.tasks
      .filter(task => task.governanceReport)
      .slice(0, 20)
      .map(task => ({
        taskId: task.id,
        goal: task.goal,
        reviewDecision: task.governanceReport?.reviewOutcome?.decision,
        reviewSummary: task.governanceReport?.reviewOutcome?.summary,
        trustAdjustment: task.governanceReport?.trustAdjustment,
        evidenceScore: task.governanceReport?.evidenceSufficiency?.score,
        sandboxScore: task.governanceReport?.sandboxReliability?.score
      }))
  };
}
