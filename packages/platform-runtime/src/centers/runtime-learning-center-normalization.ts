import type { BuildLearningCenterInput } from './runtime-learning-center';

export function normalizeLearningCenterTasks(tasks: unknown[]): BuildLearningCenterInput['tasks'] {
  return tasks.map(task => {
    if (!isRecord(task)) {
      return {} as BuildLearningCenterInput['tasks'][number];
    }

    const learningEvaluation = isRecord(task.learningEvaluation)
      ? {
          ...task.learningEvaluation,
          confidence: toOptionalNumber(task.learningEvaluation.confidence)
        }
      : task.learningEvaluation;

    return {
      ...task,
      learningEvaluation
    } as BuildLearningCenterInput['tasks'][number];
  });
}

export function normalizeLearningCenterJobs(jobs: unknown[]): BuildLearningCenterInput['jobs'] {
  return jobs.map(job => {
    if (!isRecord(job)) {
      return {} as BuildLearningCenterInput['jobs'][number];
    }

    const learningEvaluation = isRecord(job.learningEvaluation)
      ? {
          ...job.learningEvaluation,
          confidence: toOptionalNumber(job.learningEvaluation.confidence),
          candidateReasons: Array.isArray(job.learningEvaluation.candidateReasons)
            ? job.learningEvaluation.candidateReasons.filter((item): item is string => typeof item === 'string')
            : undefined,
          skippedReasons: Array.isArray(job.learningEvaluation.skippedReasons)
            ? job.learningEvaluation.skippedReasons.filter((item): item is string => typeof item === 'string')
            : undefined,
          expertiseSignals: Array.isArray(job.learningEvaluation.expertiseSignals)
            ? job.learningEvaluation.expertiseSignals.filter((item): item is string => typeof item === 'string')
            : undefined
        }
      : undefined;

    const persistedMemoryIds = Array.isArray(job.persistedMemoryIds)
      ? job.persistedMemoryIds.filter((item): item is string => typeof item === 'string')
      : undefined;

    return {
      ...job,
      sourceType: typeof job.sourceType === 'string' ? job.sourceType : undefined,
      persistedMemoryIds,
      conflictDetected: typeof job.conflictDetected === 'boolean' ? job.conflictDetected : undefined,
      updatedAt: typeof job.updatedAt === 'string' ? job.updatedAt : undefined,
      learningEvaluation
    } as BuildLearningCenterInput['jobs'][number];
  });
}

function toOptionalNumber(value: unknown): number | undefined {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
