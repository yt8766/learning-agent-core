import type { LearningCenterRecord } from '@/types/admin';

export type LearningChartKey = 'queue' | 'conflict' | 'ministry' | 'trust';

export function filterCounselorSelectors(
  selectors: LearningCenterRecord['counselorSelectorConfigs'] | undefined,
  selectorDomainFilter: string,
  selectorFeatureFlagFilter: string
) {
  return (selectors ?? []).filter(item => {
    const domainMatched =
      !selectorDomainFilter || item.domain.toLowerCase().includes(selectorDomainFilter.toLowerCase());
    const featureFlagMatched =
      !selectorFeatureFlagFilter ||
      (item.featureFlag ?? '').toLowerCase().includes(selectorFeatureFlagFilter.toLowerCase());
    return domainMatched && featureFlagMatched;
  });
}

export function buildQueueModeData(learning: LearningCenterRecord) {
  const summary = learning.learningQueueSummary?.byMode;
  if (summary) {
    return [
      { key: 'taskLearning', label: 'task-learning', value: summary.taskLearning.total },
      { key: 'dreamTask', label: 'dream-task', value: summary.dreamTask.total }
    ];
  }

  if (learning.learningQueue?.length) {
    const taskLearning = learning.learningQueue.filter(item => item.mode !== 'dream-task').length;
    const dreamTask = learning.learningQueue.filter(item => item.mode === 'dream-task').length;
    return [
      { key: 'taskLearning', label: 'task-learning', value: taskLearning },
      { key: 'dreamTask', label: 'dream-task', value: dreamTask }
    ];
  }

  return [
    {
      key: 'taskLearning',
      label: 'task-learning',
      value:
        (learning.learningQueueSummary?.taskLearningQueued ?? 0) +
        (learning.learningQueueSummary?.taskLearningProcessing ?? 0) +
        (learning.learningQueueSummary?.taskLearningCompleted ?? 0)
    },
    {
      key: 'dreamTask',
      label: 'dream-task',
      value:
        (learning.learningQueueSummary?.dreamTaskQueued ?? 0) +
        (learning.learningQueueSummary?.dreamTaskProcessing ?? 0) +
        (learning.learningQueueSummary?.dreamTaskCompleted ?? 0)
    }
  ];
}

export function buildConflictData(learning: LearningCenterRecord) {
  return [
    { key: 'open', label: 'open', value: learning.conflictGovernance?.open ?? 0 },
    { key: 'merged', label: 'merged', value: learning.conflictGovernance?.merged ?? 0 },
    { key: 'dismissed', label: 'dismissed', value: learning.conflictGovernance?.dismissed ?? 0 },
    { key: 'escalated', label: 'escalated', value: learning.conflictGovernance?.escalated ?? 0 }
  ];
}

export function buildMinistryScoreData(learning: LearningCenterRecord) {
  return (learning.ministryScorecards ?? [])
    .filter((item): item is typeof item & { ministry: string } => typeof item.ministry === 'string')
    .map(item => ({
      ministry: item.ministry,
      score: Number((item.averageScore ?? item.score ?? 0).toFixed(1))
    }));
}

export function buildTrustDistributionData(learning: LearningCenterRecord) {
  const result = { high: 0, medium: 0, low: 0 };
  for (const item of learning.capabilityTrustProfiles ?? []) {
    result[item.trustLevel] += 1;
  }
  return [
    { key: 'high', label: 'high', value: result.high },
    { key: 'medium', label: 'medium', value: result.medium },
    { key: 'low', label: 'low', value: result.low }
  ];
}

export function getRuleCandidates(learning: LearningCenterRecord) {
  return learning.candidates.filter(candidate => candidate.type === 'rule');
}
