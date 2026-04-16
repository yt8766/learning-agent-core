import type {
  CreateDocumentLearningJobDto,
  CreateResearchLearningJobDto,
  LearningConflictRecord,
  LearningJob,
  LearningQueueItem,
  RuleRecord,
  TaskRecord
} from '@agent/shared';
import type { MemoryRepository, RuleRepository, RuntimeStateRepository } from '@agent/memory';

import type { LearningFlow } from '../../../flows/learning';
import type { MainGraphLearningJobsRuntime } from '../background/main-graph-learning-jobs';
export {
  enqueueLifecycleTaskLearning,
  listLifecycleLearningQueue,
  processLifecycleLearningQueue,
  shouldEnqueueDreamTask,
  summarizeLearningCandidates
} from './main-graph-lifecycle-learning-queue';

type LearningLifecycleDeps = {
  tasks: Map<string, TaskRecord>;
  learningQueue: Map<string, LearningQueueItem>;
  runtimeStateRepository: RuntimeStateRepository;
  memoryRepository: MemoryRepository;
  ruleRepository: RuleRepository;
  learningFlow: LearningFlow;
  learningJobsRuntime: MainGraphLearningJobsRuntime;
};

export async function scanLifecycleLearningConflicts(
  deps: Pick<LearningLifecycleDeps, 'memoryRepository' | 'runtimeStateRepository'>
) {
  const records = await deps.memoryRepository.list();
  const active = records.filter(
    record =>
      !record.quarantined &&
      record.status !== 'invalidated' &&
      record.status !== 'superseded' &&
      record.status !== 'retired'
  );
  const grouped = new Map<string, typeof active>();
  for (const record of active) {
    const key = record.conflictSetId ?? record.contextSignature;
    if (!key) {
      continue;
    }
    const bucket = grouped.get(key) ?? [];
    bucket.push(record);
    grouped.set(key, bucket);
  }
  const now = new Date().toISOString();
  const conflictPairs: LearningConflictRecord[] = [];
  for (const [key, bucket] of grouped.entries()) {
    if (bucket.length < 2) {
      continue;
    }
    const sorted = bucket.slice().sort((left, right) => (right.effectiveness ?? 0) - (left.effectiveness ?? 0));
    const top = sorted[0];
    const second = sorted[1];
    const spread = Math.abs((top?.effectiveness ?? 0) - (second?.effectiveness ?? 0));
    const severity = spread >= 0.2 ? 'low' : (top?.effectiveness ?? 0) >= 0.8 ? 'high' : 'medium';
    const resolution =
      spread >= 0.2 ? 'auto_preferred' : severity === 'high' ? 'plan_question_required' : 'lightweight_review_required';
    conflictPairs.push({
      id: `conflict:${key}`,
      contextSignature: top?.contextSignature ?? key,
      conflictSetId: top?.conflictSetId,
      memoryIds: sorted.map(item => item.id),
      severity,
      resolution,
      status: 'open',
      preferredMemoryId: resolution === 'auto_preferred' ? top?.id : undefined,
      effectivenessSpread: spread,
      createdAt: now,
      updatedAt: now
    });
  }

  const snapshot = await deps.runtimeStateRepository.load();
  snapshot.governance = {
    ...(snapshot.governance ?? {}),
    learningConflictScan: {
      scannedAt: now,
      conflictPairs,
      mergeSuggestions: conflictPairs.map(item => ({
        conflictId: item.id,
        preferredMemoryId: item.preferredMemoryId,
        loserMemoryIds: item.memoryIds.filter(id => id !== item.preferredMemoryId),
        suggestion:
          item.resolution === 'auto_preferred'
            ? 'Prefer the highest-effectiveness memory and retire lower-scoring duplicates.'
            : item.resolution === 'lightweight_review_required'
              ? 'Route to lightweight review before persisting any replacement.'
              : 'Escalate to a plan-question because impact is high and scores are close.'
      })),
      manualReviewQueue: conflictPairs.filter(item => item.resolution !== 'auto_preferred')
    }
  };
  await deps.runtimeStateRepository.save(snapshot);
  return snapshot.governance.learningConflictScan;
}

export async function updateLifecycleLearningConflictStatus(
  deps: Pick<LearningLifecycleDeps, 'runtimeStateRepository'>,
  conflictId: string,
  status: LearningConflictRecord['status'],
  preferredMemoryId?: string
) {
  const snapshot = await deps.runtimeStateRepository.load();
  const current = snapshot.governance?.learningConflictScan;
  if (!current) {
    return undefined;
  }
  const now = new Date().toISOString();
  const updateRecord = (record: LearningConflictRecord) =>
    record.id === conflictId
      ? {
          ...record,
          status,
          preferredMemoryId: preferredMemoryId ?? record.preferredMemoryId,
          updatedAt: now
        }
      : record;
  const nextConflictPairs = current.conflictPairs.map(updateRecord);
  const nextManualReviewQueue =
    status === 'open'
      ? current.manualReviewQueue.some(item => item.id === conflictId)
        ? current.manualReviewQueue.map(updateRecord)
        : nextConflictPairs.filter(item => item.id === conflictId).concat(current.manualReviewQueue)
      : current.manualReviewQueue.map(updateRecord).filter(item => item.id !== conflictId || item.status === 'open');
  snapshot.governance = {
    ...(snapshot.governance ?? {}),
    learningConflictScan: {
      ...current,
      conflictPairs: nextConflictPairs,
      manualReviewQueue: nextManualReviewQueue
    }
  };
  await deps.runtimeStateRepository.save(snapshot);
  return snapshot.governance.learningConflictScan?.conflictPairs.find(item => item.id === conflictId);
}

export async function listLifecycleRules(deps: Pick<LearningLifecycleDeps, 'ruleRepository'>): Promise<RuleRecord[]> {
  return deps.ruleRepository.list();
}

export async function createLifecycleDocumentLearningJob(
  deps: Pick<LearningLifecycleDeps, 'learningJobsRuntime'>,
  dto: CreateDocumentLearningJobDto
): Promise<LearningJob> {
  return deps.learningJobsRuntime.createDocumentLearningJob(dto);
}

export async function createLifecycleResearchLearningJob(
  deps: Pick<LearningLifecycleDeps, 'learningJobsRuntime'>,
  dto: CreateResearchLearningJobDto
): Promise<LearningJob> {
  return deps.learningJobsRuntime.createResearchLearningJob(dto);
}

export function getLifecycleLearningJob(
  deps: Pick<LearningLifecycleDeps, 'learningJobsRuntime'>,
  jobId: string
): LearningJob | undefined {
  return deps.learningJobsRuntime.getLearningJob(jobId);
}

export function listLifecycleLearningJobs(deps: Pick<LearningLifecycleDeps, 'learningJobsRuntime'>): LearningJob[] {
  return deps.learningJobsRuntime.listLearningJobs();
}
