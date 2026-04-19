import type { BuildLearningCenterInput } from './runtime-learning-center.types';

export async function buildLearningCenterSummary(input: BuildLearningCenterInput) {
  const learningQueue = input.learningQueue ?? [];
  const learningCandidates = input.tasks.flatMap(task => task.learningCandidates ?? []);
  const ruleCandidates = input.deriveRuleCandidates?.(input.tasks) ?? [];
  const mergedCandidateCount = learningCandidates.length + ruleCandidates.length;

  const [memoryStats, invalidatedRules, resolutionCandidates]: [
    Awaited<typeof input.memoryStatsPromise>,
    number,
    Awaited<NonNullable<typeof input.resolutionCandidatesPromise>> | undefined
  ] = await Promise.all([input.memoryStatsPromise, input.invalidatedRulesPromise, input.resolutionCandidatesPromise]);

  return {
    totalCandidates: mergedCandidateCount,
    pendingCandidates: [...ruleCandidates, ...learningCandidates].filter(
      candidate => candidate.status === 'pending_confirmation'
    ).length,
    confirmedCandidates: [...ruleCandidates, ...learningCandidates].filter(
      candidate => candidate.status === 'confirmed'
    ).length,
    researchJobs: input.jobs.filter(job => job.sourceType === 'research').length,
    autoPersistedResearchJobs: input.jobs.filter(job => (job.persistedMemoryIds?.length ?? 0) > 0).length,
    conflictingResearchJobs: input.jobs.filter(job => job.conflictDetected).length,
    invalidatedMemories: memoryStats.invalidated,
    quarantinedMemories: memoryStats.quarantined,
    invalidatedRules,
    queuedLearningTasks: input.tasks.filter(task => Boolean(task.learningQueueItemId)).length,
    learningQueueSummary: {
      total: learningQueue.length,
      queued: learningQueue.filter(item => item.status === 'queued').length,
      processing: learningQueue.filter(item => item.status === 'running').length,
      blocked: learningQueue.filter(item => item.status === 'blocked').length,
      completed: learningQueue.filter(item => item.status === 'completed').length,
      taskLearningQueued: learningQueue.filter(
        item => (item.mode ?? 'task-learning') === 'task-learning' && item.status === 'queued'
      ).length,
      taskLearningProcessing: learningQueue.filter(
        item => (item.mode ?? 'task-learning') === 'task-learning' && item.status === 'running'
      ).length,
      taskLearningCompleted: learningQueue.filter(
        item => (item.mode ?? 'task-learning') === 'task-learning' && item.status === 'completed'
      ).length,
      dreamTaskQueued: learningQueue.filter(item => item.mode === 'dream-task' && item.status === 'queued').length,
      dreamTaskProcessing: learningQueue.filter(item => item.mode === 'dream-task' && item.status === 'running').length,
      dreamTaskCompleted: learningQueue.filter(item => item.mode === 'dream-task' && item.status === 'completed')
        .length,
      byMode: {
        taskLearning: {
          total: learningQueue.filter(item => (item.mode ?? 'task-learning') === 'task-learning').length,
          queued: learningQueue.filter(
            item => (item.mode ?? 'task-learning') === 'task-learning' && item.status === 'queued'
          ).length,
          processing: learningQueue.filter(
            item => (item.mode ?? 'task-learning') === 'task-learning' && item.status === 'running'
          ).length,
          blocked: learningQueue.filter(
            item => (item.mode ?? 'task-learning') === 'task-learning' && item.status === 'blocked'
          ).length,
          completed: learningQueue.filter(
            item => (item.mode ?? 'task-learning') === 'task-learning' && item.status === 'completed'
          ).length
        },
        dreamTask: {
          total: learningQueue.filter(item => item.mode === 'dream-task').length,
          queued: learningQueue.filter(item => item.mode === 'dream-task' && item.status === 'queued').length,
          processing: learningQueue.filter(item => item.mode === 'dream-task' && item.status === 'running').length,
          blocked: learningQueue.filter(item => item.mode === 'dream-task' && item.status === 'blocked').length,
          completed: learningQueue.filter(item => item.mode === 'dream-task' && item.status === 'completed').length
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
    conflictGovernance: {
      manualReviewCount: 0,
      mergeSuggestionCount: 0,
      openConflictCount: 0
    },
    averageEvaluationScore:
      input.tasks
        .filter(task => task.learningEvaluation?.score != null)
        .reduce((sum, task) => sum + (task.learningEvaluation?.score ?? 0), 0) /
      Math.max(1, input.tasks.filter(task => task.learningEvaluation?.score != null).length),
    autoConfirmableCandidates: [...ruleCandidates, ...learningCandidates].filter(
      candidate => candidate.autoConfirmEligible
    ).length,
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
    candidates: [],
    recentJobs: [],
    localSkillSuggestions: [],
    recentSkillGovernance: [],
    recentGovernanceReports: [],
    capabilityTrustProfiles: [],
    ministryGovernanceProfiles: [],
    workerGovernanceProfiles: [],
    specialistGovernanceProfiles: [],
    ministryScorecards: [],
    budgetEfficiencyWarnings: [],
    learningQueue: [],
    counselorSelectorConfigs: [],
    recentQuarantinedMemories: [],
    recentCrossCheckEvidence: [],
    quarantineCategoryStats: {},
    quarantineRestoreSuggestions: []
  };
}
