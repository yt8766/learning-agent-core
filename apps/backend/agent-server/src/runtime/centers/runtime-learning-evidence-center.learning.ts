import { buildRuleCandidates } from '../helpers/runtime-derived-records';
import {
  buildCapabilityTrustProfiles,
  queuePriorityScore,
  summarizeCounselorExperiments,
  toGovernanceProfileSummary
} from './runtime-learning-evidence-center.learning-helpers';
import type {
  BuildLearningCenterInput,
  CrossCheckEvidenceEntry,
  LocalSkillSuggestionsRecord
} from './runtime-learning-evidence-center.types';

export async function buildLearningCenter(input: BuildLearningCenterInput) {
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
  const ruleCandidates = buildRuleCandidates(input.tasks);
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
    governanceSnapshot
  ]: [
    Awaited<NonNullable<typeof input.wenyuanOverviewPromise>> | undefined,
    Awaited<NonNullable<typeof input.knowledgeOverviewPromise>> | undefined,
    Awaited<typeof input.memoryStatsPromise>,
    number,
    CrossCheckEvidenceEntry[],
    LocalSkillSuggestionsRecord[],
    Awaited<NonNullable<typeof input.governanceSnapshotPromise>> | undefined
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
    input.governanceSnapshotPromise
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
      .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
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
    learningQueue: (input.learningQueue ?? [])
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
      total: (input.learningQueue ?? []).length,
      running: (input.learningQueue ?? []).filter(item => item.status === 'running').length,
      queued: (input.learningQueue ?? []).filter(item => item.status === 'queued').length,
      completed: (input.learningQueue ?? []).filter(item => item.status === 'completed').length
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
    ministryGovernanceProfiles: persistedMinistryProfiles.map(toGovernanceProfileSummary).slice(0, 12),
    workerGovernanceProfiles: persistedWorkerProfiles.map(toGovernanceProfileSummary).slice(0, 12),
    specialistGovernanceProfiles: persistedSpecialistProfiles.map(toGovernanceProfileSummary).slice(0, 12),
    recentGovernanceReports: input.tasks
      .filter(task => task.governanceReport)
      .slice(0, 12)
      .map(task => ({
        taskId: task.id,
        summary: task.governanceReport?.summary ?? '',
        reviewDecision: task.governanceReport?.reviewOutcome.decision ?? 'pass',
        evidenceScore: task.governanceReport?.evidenceSufficiency.score ?? 0,
        sandboxScore: task.governanceReport?.sandboxReliability.score ?? 0,
        trustAdjustment: task.governanceReport?.trustAdjustment ?? 'hold'
      })),
    ministryScorecards: input.tasks
      .filter(task => task.evaluationReport || task.learningEvaluation)
      .slice(0, 20)
      .map(task => ({
        taskId: task.id,
        goal: task.goal,
        evaluationReportId: task.libuEvaluationReportId,
        score: task.evaluationReport?.score ?? task.learningEvaluation?.score,
        confidence: task.learningEvaluation?.confidence,
        summary: task.evaluationReport?.summary ?? task.learningEvaluation?.rationale,
        governanceWarnings: task.learningEvaluation?.governanceWarnings ?? []
      })),
    budgetEfficiencyWarnings: input.tasks
      .filter(
        task =>
          task.budgetState?.budgetInterruptState?.status && task.budgetState.budgetInterruptState.status !== 'idle'
      )
      .slice(0, 10)
      .map(task => ({
        taskId: task.id,
        goal: task.goal,
        status: task.budgetState?.budgetInterruptState?.status,
        reason: task.budgetState?.budgetInterruptState?.reason
      })),
    averageEvaluationScore:
      input.tasks
        .filter(task => task.learningEvaluation?.score != null)
        .reduce((sum, task) => sum + (task.learningEvaluation?.score ?? 0), 0) /
      Math.max(1, input.tasks.filter(task => task.learningEvaluation?.score != null).length),
    autoConfirmableCandidates: mergedCandidates.filter(candidate => candidate.autoConfirmEligible).length,
    candidates: mergedCandidates,
    recentSkillGovernance: input.tasks
      .flatMap(task => {
        const recommendations = (
          task.learningEvaluation as
            | {
                skillGovernanceRecommendations?: Array<{
                  skillId: string;
                  recommendation: string;
                  successRate?: number;
                  promotionState?: string;
                }>;
              }
            | undefined
        )?.skillGovernanceRecommendations;

        return (recommendations ?? []).map(item => ({
          taskId: task.id,
          goal: task.goal,
          skillId: item.skillId,
          recommendation: item.recommendation,
          successRate: item.successRate,
          promotionState: item.promotionState,
          updatedAt: task.updatedAt
        }));
      })
      .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
      .slice(0, 12),
    localSkillSuggestions
  };
}
