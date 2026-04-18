import type { LearningFlow } from '../../../flows/learning';
import type { RuntimeLearningQueueItem as LearningQueueItem } from '../../../runtime/runtime-learning.types';
import type { RuntimeTaskRecord as TaskRecord } from '../../../runtime/runtime-task.types';
import { enqueueTaskLearningItem, listLearningQueueItems } from './main-graph-lifecycle-state';

type LearningPersistDeps = {
  persistAndEmitTask: (task: TaskRecord) => Promise<void>;
};

export async function processLifecycleLearningQueue(
  deps: {
    tasks: Map<string, TaskRecord>;
    learningQueue: Map<string, LearningQueueItem>;
    learningFlow: LearningFlow;
  } & LearningPersistDeps,
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

export function listLifecycleLearningQueue(deps: {
  learningQueue: Map<string, LearningQueueItem>;
}): LearningQueueItem[] {
  return listLearningQueueItems(deps.learningQueue);
}

export function enqueueLifecycleTaskLearning(
  deps: { learningQueue: Map<string, LearningQueueItem> },
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

export function shouldEnqueueDreamTask(task: TaskRecord): boolean {
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

export function summarizeLearningCandidates(task: TaskRecord) {
  const counts: Record<NonNullable<TaskRecord['learningCandidates']>[number]['type'], number> = {
    memory: 0,
    rule: 0,
    skill: 0,
    reflection: 0,
    profile_patch: 0,
    override: 0
  };
  for (const candidate of task.learningCandidates ?? []) {
    counts[candidate.type] += 1;
  }
  return {
    counts,
    summary: `候选整理完成：memory ${counts.memory} 条，rule ${counts.rule} 条，skill ${counts.skill} 条。`
  };
}
