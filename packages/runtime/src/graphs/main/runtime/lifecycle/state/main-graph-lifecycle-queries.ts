import type {
  AgentExecutionState,
  AgentMessageRecord as AgentMessage,
  CreateDocumentLearningJobDto,
  CreateResearchLearningJobDto,
  ExecutionTrace,
  ManagerPlan,
  ReviewRecord,
  WorkerDefinition
} from '@agent/core';
import type { LearningConflictRecord } from '@agent/knowledge';
import type { LearningCandidateRecord, RuleRecord } from '@agent/memory';
import type {
  RuntimeLearningJob as LearningJob,
  RuntimeLearningQueueItem as LearningQueueItem
} from '../../../../../runtime/runtime-learning.types';
import type { RuntimeTaskRecord as TaskRecord } from '../../../../../runtime/runtime-task.types';

import {
  createLifecycleDocumentLearningJob,
  createLifecycleResearchLearningJob,
  enqueueLifecycleTaskLearning,
  getLifecycleLearningJob,
  listLifecycleLearningJobs,
  listLifecycleLearningQueue,
  listLifecycleRules,
  processLifecycleLearningQueue,
  scanLifecycleLearningConflicts,
  updateLifecycleLearningConflictStatus
} from '../learning/main-graph-lifecycle-learning';
import {
  acquireLifecycleBackgroundLease,
  cancelLifecycleTask,
  deleteLifecycleSessionState,
  heartbeatLifecycleBackgroundLease,
  isLifecycleWorkerEnabled,
  listExpiredLifecycleBackgroundLeases,
  listLifecycleTaskTraces,
  listLifecycleWorkers,
  listQueuedLifecycleBackgroundTasks,
  markLifecycleBackgroundTaskRunnerFailure,
  reclaimExpiredLifecycleBackgroundLease,
  registerLifecycleWorker,
  releaseLifecycleBackgroundLease,
  retryLifecycleTask,
  runLifecycleBackgroundTask,
  setLifecycleWorkerEnabled
} from './main-graph-lifecycle-background';
import type { MainGraphLifecycleParams } from '../main-graph-lifecycle.types';

export abstract class MainGraphLifecycleQueries {
  constructor(protected readonly params: MainGraphLifecycleParams) {}

  protected abstract initialize(): Promise<void>;
  protected abstract getBackgroundLifecycleDeps(): {
    workerRegistry: MainGraphLifecycleParams['workerRegistry'];
    backgroundRuntime: MainGraphLifecycleParams['backgroundRuntime'];
    listTasks: () => TaskRecord[];
    initialize: () => Promise<void>;
  };
  protected abstract persistAndEmitTask(task: TaskRecord): Promise<void>;
  protected abstract handleInterruptTimeout(task: TaskRecord, now: string): Promise<TaskRecord | undefined>;

  getTask(taskId: string) {
    return this.params.tasks.get(taskId);
  }
  listTasks(): TaskRecord[] {
    return [...this.params.tasks.values()].sort(
      (l, r) => new Date(r.updatedAt).getTime() - new Date(l.updatedAt).getTime()
    );
  }
  listPendingApprovals(): TaskRecord[] {
    return this.listTasks().filter(task => task.approvals.some(approval => approval.decision === 'pending'));
  }
  listWorkers() {
    return listLifecycleWorkers(this.params.workerRegistry);
  }
  registerWorker(worker: WorkerDefinition) {
    registerLifecycleWorker(this.params.workerRegistry, worker);
  }
  setWorkerEnabled(workerId: string, enabled: boolean) {
    setLifecycleWorkerEnabled(this.params.workerRegistry, workerId, enabled);
  }
  isWorkerEnabled(workerId: string) {
    return isLifecycleWorkerEnabled(this.params.workerRegistry, workerId);
  }
  listQueuedBackgroundTasks(): TaskRecord[] {
    return listQueuedLifecycleBackgroundTasks(this.params.backgroundRuntime, () => this.listTasks());
  }
  async acquireBackgroundLease(taskId: string, owner: string, ttlMs: number) {
    return acquireLifecycleBackgroundLease(this.getBackgroundLifecycleDeps(), taskId, owner, ttlMs);
  }
  async heartbeatBackgroundLease(taskId: string, owner: string, ttlMs: number) {
    return heartbeatLifecycleBackgroundLease(this.getBackgroundLifecycleDeps(), taskId, owner, ttlMs);
  }
  async releaseBackgroundLease(taskId: string, owner: string) {
    return releaseLifecycleBackgroundLease(this.getBackgroundLifecycleDeps(), taskId, owner);
  }
  listExpiredBackgroundLeases(): TaskRecord[] {
    return listExpiredLifecycleBackgroundLeases(this.params.backgroundRuntime, () => this.listTasks());
  }
  async reclaimExpiredBackgroundLease(taskId: string, owner: string) {
    return reclaimExpiredLifecycleBackgroundLease(this.getBackgroundLifecycleDeps(), taskId, owner);
  }
  async runBackgroundTask(taskId: string) {
    return runLifecycleBackgroundTask(this.getBackgroundLifecycleDeps(), taskId);
  }
  async markBackgroundTaskRunnerFailure(taskId: string, reason: string) {
    return markLifecycleBackgroundTaskRunnerFailure(this.getBackgroundLifecycleDeps(), taskId, reason);
  }
  listTaskTraces(taskId: string): ExecutionTrace[] {
    return listLifecycleTaskTraces(this.params.tasks, taskId);
  }
  getTaskAgents(taskId: string): AgentExecutionState[] {
    return this.params.tasks.get(taskId)?.agentStates ?? [];
  }
  getTaskMessages(taskId: string): AgentMessage[] {
    return this.params.tasks.get(taskId)?.messages ?? [];
  }
  getTaskPlan(taskId: string): ManagerPlan | undefined {
    return this.params.tasks.get(taskId)?.plan;
  }
  getTaskReview(taskId: string): ReviewRecord | undefined {
    return this.params.tasks.get(taskId)?.review;
  }
  async retryTask(taskId: string) {
    return retryLifecycleTask(this.getBackgroundLifecycleDeps(), taskId);
  }
  async cancelTask(taskId: string, reason?: string) {
    return cancelLifecycleTask(this.getBackgroundLifecycleDeps(), taskId, reason);
  }
  async deleteSessionState(sessionId: string) {
    await deleteLifecycleSessionState(this.getBackgroundLifecycleDeps(), sessionId);
  }
  ensureLearningCandidates(task: TaskRecord): LearningCandidateRecord[] {
    return this.params.learningFlow.ensureCandidates(task);
  }
  async confirmLearning(taskId: string, candidateIds?: string[]): Promise<TaskRecord | undefined> {
    await this.initialize();
    const task = this.params.tasks.get(taskId);
    if (!task) return undefined;
    this.params.learningFlow.ensureCandidates(task);
    await this.params.learningFlow.confirmCandidates(task, candidateIds);
    task.updatedAt = new Date().toISOString();
    await this.persistAndEmitTask(task);
    return task;
  }
  async sweepInterruptTimeouts(): Promise<TaskRecord[]> {
    await this.initialize();
    const now = new Date().toISOString();
    const timedOut = this.listTasks().filter(task => {
      const interrupt = task.activeInterrupt;
      return Boolean(
        interrupt &&
        interrupt.status === 'pending' &&
        interrupt.timeoutMinutes &&
        new Date(interrupt.createdAt).getTime() + interrupt.timeoutMinutes * 60_000 <= new Date(now).getTime()
      );
    });
    const updated: TaskRecord[] = [];
    for (const task of timedOut) {
      const result = await this.handleInterruptTimeout(task, now);
      if (result) {
        updated.push(result);
      }
    }
    return updated;
  }
  async scanLearningConflicts() {
    await this.initialize();
    return scanLifecycleLearningConflicts(this.params);
  }
  async processLearningQueue(maxItems?: number): Promise<LearningQueueItem[]> {
    await this.initialize();
    return processLifecycleLearningQueue(
      {
        tasks: this.params.tasks,
        learningQueue: this.params.learningQueue,
        learningFlow: this.params.learningFlow,
        persistAndEmitTask: task => this.persistAndEmitTask(task)
      },
      maxItems
    );
  }
  async processQueuedLearningJobs(maxItems?: number): Promise<LearningJob[]> {
    await this.initialize();
    return this.params.learningJobsRuntime.processQueuedLearningJobs(maxItems);
  }
  async updateLearningConflictStatus(
    conflictId: string,
    status: LearningConflictRecord['status'],
    preferredMemoryId?: string
  ) {
    await this.initialize();
    return updateLifecycleLearningConflictStatus(this.params, conflictId, status, preferredMemoryId);
  }
  async listRules(): Promise<RuleRecord[]> {
    await this.initialize();
    return listLifecycleRules(this.params);
  }
  async createDocumentLearningJob(dto: CreateDocumentLearningJobDto): Promise<LearningJob> {
    await this.initialize();
    return createLifecycleDocumentLearningJob(this.params, dto);
  }
  async createResearchLearningJob(dto: CreateResearchLearningJobDto): Promise<LearningJob> {
    await this.initialize();
    return createLifecycleResearchLearningJob(this.params, dto);
  }
  getLearningJob(jobId: string): LearningJob | undefined {
    return getLifecycleLearningJob(this.params, jobId);
  }
  listLearningJobs(): LearningJob[] {
    return listLifecycleLearningJobs(this.params);
  }
  listLearningQueue(): LearningQueueItem[] {
    return listLifecycleLearningQueue(this.params);
  }
  enqueueTaskLearning(task: TaskRecord, userFeedback?: string): LearningQueueItem {
    return enqueueLifecycleTaskLearning(this.params, task, userFeedback);
  }
}
