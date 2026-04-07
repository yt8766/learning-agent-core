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
import { enqueueTaskLearningItem, listLearningQueueItems } from './main-graph-lifecycle-state';

type LearningLifecycleDeps = {
  tasks: Map<string, TaskRecord>;
  learningQueue: Map<string, LearningQueueItem>;
  runtimeStateRepository: RuntimeStateRepository;
  memoryRepository: MemoryRepository;
  ruleRepository: RuleRepository;
  learningFlow: LearningFlow;
  learningJobsRuntime: MainGraphLearningJobsRuntime;
};

type LearningPersistDeps = {
  persistAndEmitTask: (task: TaskRecord) => Promise<void>;
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

export async function processLifecycleLearningQueue(
  deps: Pick<LearningLifecycleDeps, 'tasks' | 'learningQueue' | 'learningFlow'> & LearningPersistDeps,
  maxItems?: number
): Promise<LearningQueueItem[]> {
  const queued = listLearningQueueItems(deps.learningQueue).filter(item => item.status === 'queued');
  if (!queued.length) {
    return [];
  }
  const hasHighPriority = queued.some(item => item.priority === 'high');
  const limit = maxItems ?? (hasHighPriority ? 3 : 1);
  const selected = queued.slice(0, limit);
  const processed: LearningQueueItem[] = [];
  const now = new Date().toISOString();

  for (const item of selected) {
    const startedAt = new Date().toISOString();
    const task = deps.tasks.get(item.taskId);
    if (!task) {
      const failed = {
        ...item,
        status: 'failed' as const,
        updatedAt: startedAt,
        userFeedback: item.userFeedback ?? 'task_not_found'
      };
      deps.learningQueue.set(failed.id, failed);
      processed.push(failed);
      continue;
    }

    const processing: LearningQueueItem = {
      ...item,
      status: 'running',
      updatedAt: startedAt
    };
    deps.learningQueue.set(processing.id, processing);
    task.backgroundLearningState = {
      status: 'running',
      mode: processing.mode ?? 'task-learning',
      queuedAt: task.backgroundLearningState?.queuedAt ?? processing.queuedAt,
      startedAt,
      summary:
        processing.mode === 'dream-task' ? '梦修纂任务正在后台整理长期记忆候选。' : '学习沉淀任务正在后台物化候选。',
      updatedAt: startedAt
    };
    deps.learningFlow.ensureCandidates(task);
    if (processing.mode === 'dream-task') {
      task.updatedAt = startedAt;
      const completedAt = new Date().toISOString();
      const candidateCounts = summarizeLearningCandidates(task);
      const completed: LearningQueueItem = {
        ...processing,
        status: 'completed',
        aggregationResult: candidateCounts.summary,
        updatedAt: completedAt,
        reason: 'dream-task'
      };
      deps.learningQueue.set(completed.id, completed);
      task.backgroundLearningState = {
        status: 'completed',
        mode: 'dream-task',
        queuedAt: task.backgroundLearningState.queuedAt,
        startedAt,
        finishedAt: completedAt,
        summary: `梦修纂已完成：${candidateCounts.summary}`,
        updatedAt: completedAt
      };
      task.updatedAt = completedAt;
      await deps.persistAndEmitTask(task);
      processed.push(completed);
      continue;
    }
    const autoConfirmCandidateIds = task.learningEvaluation?.autoConfirmCandidateIds?.length
      ? task.learningEvaluation.autoConfirmCandidateIds
      : (task.learningCandidates?.filter(candidate => candidate.autoConfirmEligible).map(candidate => candidate.id) ??
        []);
    if (autoConfirmCandidateIds.length > 0) {
      await deps.learningFlow.confirmCandidates(task, autoConfirmCandidateIds);
    }
    task.updatedAt = startedAt;
    const completedAt = new Date().toISOString();
    const completed: LearningQueueItem = {
      ...processing,
      status: 'completed',
      aggregationResult: task.result ?? processing.aggregationResult,
      updatedAt: completedAt
    };
    deps.learningQueue.set(completed.id, completed);
    task.backgroundLearningState = {
      status: 'completed',
      mode: 'task-learning',
      queuedAt: task.backgroundLearningState?.queuedAt ?? processing.queuedAt,
      startedAt,
      finishedAt: completedAt,
      summary: '学习沉淀任务已完成后台处理。',
      updatedAt: completedAt
    };
    await deps.persistAndEmitTask(task);
    processed.push(completed);
  }

  return processed;
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

export function listLifecycleLearningQueue(deps: Pick<LearningLifecycleDeps, 'learningQueue'>): LearningQueueItem[] {
  return listLearningQueueItems(deps.learningQueue);
}

export function enqueueLifecycleTaskLearning(
  deps: Pick<LearningLifecycleDeps, 'learningQueue'>,
  task: TaskRecord,
  userFeedback?: string
): LearningQueueItem {
  const queued = enqueueTaskLearningItem(deps.learningQueue, task, userFeedback, {
    mode: 'task-learning'
  });
  if (shouldEnqueueDreamTask(task)) {
    enqueueTaskLearningItem(deps.learningQueue, task, userFeedback, {
      mode: 'dream-task'
    });
  }
  return queued;
}

function shouldEnqueueDreamTask(task: TaskRecord): boolean {
  if (task.review?.decision === 'blocked') {
    return true;
  }
  if (task.critiqueResult?.decision === 'revise_required' || task.critiqueResult?.decision === 'block') {
    return true;
  }
  if (task.approvalFeedback) {
    return true;
  }
  if ((task.learningEvaluation?.score ?? 0) >= 85) {
    return true;
  }
  return Boolean((task.learningEvaluation?.notes ?? []).some(note => /(纠正|偏好|成功案例|稳定流程|高频)/.test(note)));
}

function summarizeLearningCandidates(task: TaskRecord) {
  const counts = {
    memory: 0,
    rule: 0,
    skill: 0
  };
  for (const candidate of task.learningCandidates ?? []) {
    counts[candidate.type] += 1;
  }
  return {
    counts,
    summary: `候选整理完成：memory ${counts.memory} 条，rule ${counts.rule} 条，skill ${counts.skill} 条。`
  };
}
