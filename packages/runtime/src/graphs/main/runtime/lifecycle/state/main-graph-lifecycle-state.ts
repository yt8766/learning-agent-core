import type { PendingExecutionRecord, RuntimeStateRepository } from '@agent/memory';

import type { PendingExecutionContext } from '../../../../../flows/approval';
import type {
  RuntimeLearningJob as LearningJob,
  RuntimeLearningQueueItem as LearningQueueItem
} from '../../../../../runtime/runtime-learning.types';
import type { RuntimeTaskRecord as TaskRecord } from '../../../../../runtime/runtime-task.types';

export function listLearningQueueItems(learningQueue: Map<string, LearningQueueItem>): LearningQueueItem[] {
  return [...learningQueue.values()].sort((left, right) => {
    const priorityGap = priorityScore(right.priority) - priorityScore(left.priority);
    if (priorityGap !== 0) {
      return priorityGap;
    }
    return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
  });
}

export function enqueueTaskLearningItem(
  learningQueue: Map<string, LearningQueueItem>,
  task: TaskRecord,
  userFeedback?: string,
  options?: {
    mode?: 'task-learning' | 'dream-task';
    itemId?: string;
  }
): LearningQueueItem {
  const now = new Date().toISOString();
  const mode = options?.mode ?? task.backgroundLearningState?.mode ?? 'task-learning';
  const item: LearningQueueItem = {
    id:
      options?.itemId ??
      (mode === 'dream-task'
        ? `dream_learning_queue_${task.id}`
        : (task.learningQueueItemId ?? `learning_queue_${task.id}`)),
    taskId: task.id,
    runId: task.runId,
    status: 'queued',
    mode,
    priority: resolveLearningQueuePriority(task),
    reason: resolveLearningQueueReason(task),
    selectedCounselorId:
      task.executionPlan?.selectedCounselorId ?? task.entryDecision?.counselorSelector?.selectedCounselorId,
    selectedVersion: task.executionPlan?.selectedVersion ?? task.entryDecision?.counselorSelector?.selectedVersion,
    trace: [...task.trace],
    aggregationResult: task.result,
    userFeedback,
    capabilityUsageStats: {
      toolCount: task.toolUsageSummary?.length ?? 0,
      workerCount: new Set(task.modelRoute?.map(item => item.workerId) ?? []).size,
      totalTokens: task.llmUsage?.totalTokens,
      totalCostUsd: task.budgetState?.costConsumedUsd
    },
    queuedAt: now,
    updatedAt: now
  };
  if (mode === 'task-learning') {
    task.learningQueueItemId = item.id;
  }
  task.backgroundLearningState = {
    status: 'queued',
    mode: item.mode ?? 'task-learning',
    queuedAt: now,
    summary:
      item.mode === 'dream-task'
        ? '梦修纂任务已入队，等待后台整理长期记忆候选。'
        : '学习沉淀任务已入队，等待后台异步处理。',
    updatedAt: now
  };
  learningQueue.set(item.id, item);
  return item;
}

export async function persistLifecycleSnapshot(params: {
  runtimeStateRepository: RuntimeStateRepository;
  tasks: Map<string, TaskRecord>;
  learningJobs: Map<string, LearningJob>;
  learningQueue: Map<string, LearningQueueItem>;
  pendingExecutions: Map<string, PendingExecutionContext>;
}) {
  const snapshot = await params.runtimeStateRepository.load();
  await params.runtimeStateRepository.save({
    ...snapshot,
    tasks: [...params.tasks.values()],
    learningJobs: [...params.learningJobs.values()],
    learningQueue: [...params.learningQueue.values()],
    pendingExecutions: [...params.pendingExecutions.values()]
  });
}

export async function hydrateLifecycleSnapshot(params: {
  runtimeStateRepository: RuntimeStateRepository;
  tasks: Map<string, TaskRecord>;
  learningJobs: Map<string, LearningJob>;
  learningQueue: Map<string, LearningQueueItem>;
  pendingExecutions: Map<string, PendingExecutionContext>;
}) {
  const snapshot = await params.runtimeStateRepository.load();
  params.tasks.clear();
  params.learningJobs.clear();
  params.learningQueue.clear();
  params.pendingExecutions.clear();
  for (const task of snapshot.tasks) params.tasks.set(task.id, task);
  for (const job of snapshot.learningJobs) params.learningJobs.set(job.id, job);
  for (const item of snapshot.learningQueue ?? []) params.learningQueue.set(item.id, item);
  for (const pending of snapshot.pendingExecutions as PendingExecutionRecord[]) {
    params.pendingExecutions.set(pending.taskId, pending as PendingExecutionContext);
  }
}

function resolveLearningQueuePriority(task: TaskRecord): LearningQueueItem['priority'] {
  if (task.review?.decision === 'blocked') return 'high';
  if ((task.learningEvaluation?.score ?? 0) >= 80) return 'high';
  return 'normal';
}

function resolveLearningQueueReason(task: TaskRecord): LearningQueueItem['reason'] {
  if (task.review?.decision === 'blocked') return 'blocked_review';
  if (task.approvalFeedback) return 'rollback';
  if ((task.learningEvaluation?.timeoutStats?.defaultAppliedCount ?? 0) > 0) return 'timeout_defaulted';
  return 'normal';
}

function priorityScore(priority: LearningQueueItem['priority']) {
  return priority === 'high' ? 2 : 1;
}
