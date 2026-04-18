import type {
  AgentExecutionState,
  ApprovalActionDto,
  CreateTaskDto,
  ReviewRecord,
  SkillSearchStateRecord
} from '@agent/core';
import { ActionIntent, ApprovalDecision } from '@agent/core';
import { PendingExecutionRecord } from '@agent/memory';
import type { RuntimeTaskRecord as TaskRecord } from '../../../runtime/runtime-task.types';

import {
  appendDiagnosisEvidence,
  buildCitationSourceSummary,
  buildFreshnessSourceSummary,
  recordAgentError
} from '../knowledge/main-graph-knowledge';
import { resolveWorkflowPreset } from '../../../bridges/supervisor-runtime-bridge';
import { enqueueTaskLearningItem, listLearningQueueItems } from './main-graph-lifecycle-state';
import { applyApprovalAction, handleLifecycleInterruptTimeout } from './main-graph-lifecycle-approval';
import {
  applyLifecycleCounselorSelectorGovernance,
  resolveLifecycleKnowledgeReuse
} from './main-graph-lifecycle-governance';
import {
  buildSkillInstallPendingExecution,
  enforceInterruptControllerPolicy,
  finalizeLifecycleTaskState,
  hydrateLifecycleState,
  persistLifecycleState,
  upsertLifecycleFreshnessEvidence
} from './main-graph-lifecycle-persistence';
import { isSkillInstallApprovalPending, resolveCreatedTaskDispatch } from './main-graph-lifecycle-routing';
import { MainGraphLifecycleQueries } from './main-graph-lifecycle-queries';
import type { MainGraphLifecycleParams } from './main-graph-lifecycle.types';
import type { PendingExecutionContext } from '../../../flows/approval';
import { isFreshnessSensitiveGoal } from '../../../utils/prompts/temporal-context';
export class MainGraphLifecycle extends MainGraphLifecycleQueries {
  private initializationPromise?: Promise<void>;

  constructor(protected readonly params: MainGraphLifecycleParams) {
    super(params);
  }

  async initialize(): Promise<void> {
    if (!this.initializationPromise) {
      this.initializationPromise = this.hydrateRuntimeState();
    }
    await this.initializationPromise;
  }

  async createTask(dto: CreateTaskDto): Promise<TaskRecord> {
    await this.initialize();
    const now = new Date().toISOString();
    const taskId = `task_${Date.now()}`;
    const runId = `run_${Date.now()}`;
    const workflowResolution = resolveWorkflowPreset(dto.goal, {
      constraints: dto.constraints,
      context: dto.context
    });
    const governedDto = await applyLifecycleCounselorSelectorGovernance({
      dto,
      workflowResolution,
      runtimeStateRepository: this.params.runtimeStateRepository
    });
    const knowledgeReuse = await resolveLifecycleKnowledgeReuse({
      taskId,
      runId,
      goal: workflowResolution.normalizedGoal,
      createdAt: now,
      memoryRepository: this.params.memoryRepository,
      memorySearchService: this.params.memorySearchService
    });
    const { task, normalizedGoal } = await this.params.taskFactory.createTaskRecord(
      governedDto,
      knowledgeReuse,
      this.params.getLocalSkillSuggestionResolver(),
      this.params.getPreExecutionSkillInterventionResolver(),
      { now, taskId, runId },
      { deferPreExecutionSkillIntervention: true }
    );
    this.upsertFreshnessEvidence(task);
    this.params.tasks.set(task.id, task);
    await this.persistAndEmitTask(task);
    if (task.sessionId) {
      await this.params.runBootstrapGraph(task, { ...governedDto, goal: normalizedGoal }, { mode: 'initial' });
    }
    const dispatch = resolveCreatedTaskDispatch(task);
    if (dispatch.kind === 'wait_approval') {
      if (isSkillInstallApprovalPending(task)) {
        const pendingExecution = buildSkillInstallPendingExecution(task, normalizedGoal);
        if (pendingExecution) {
          this.params.pendingExecutions.set(task.id, pendingExecution);
        }
      }
      return task;
    }
    if (dispatch.kind === 'session_bootstrap_and_pipeline') {
      await this.params.runTaskPipeline(task, { ...dto, goal: normalizedGoal }, { mode: 'initial' });
      return task;
    }

    this.params.addTrace(task.trace, 'background_queued', '后台任务已入队，等待后台 runner 消费执行。', {
      mode: 'background',
      runId: task.runId
    });
    this.params.markSubgraph(task, 'background-runner');
    this.params.addProgressDelta(task, '后台任务已入队，等待后台执行器调度。');
    await this.persistAndEmitTask(task);
    return task;
  }

  async resolveRuntimeSkillIntervention(params: {
    task: TaskRecord;
    goal: string;
    currentStep: 'direct_reply' | 'research';
    skillSearch: SkillSearchStateRecord;
    usedInstalledSkills?: string[];
  }) {
    const resolver = this.params.getRuntimeSkillInterventionResolver();
    return resolver ? resolver(params) : undefined;
  }

  getPreExecutionSkillInterventionResolver() {
    return this.params.getPreExecutionSkillInterventionResolver();
  }

  async resolveSkillInstallInterruptResume(params: {
    task: TaskRecord;
    receiptId: string;
    skillDisplayName?: string;
    usedInstalledSkills?: string[];
    actor?: string;
  }) {
    const resolver = this.params.getSkillInstallApprovalResolver();
    if (!resolver) {
      return undefined;
    }

    return resolver({
      task: params.task,
      pending: {
        taskId: params.task.id,
        intent: ActionIntent.INSTALL_SKILL,
        toolName: params.task.pendingApproval?.toolName ?? 'npx skills add',
        researchSummary: params.task.goal,
        kind: 'skill_install',
        receiptId: params.receiptId,
        goal: params.task.goal,
        usedInstalledSkills: params.usedInstalledSkills,
        skillDisplayName: params.skillDisplayName,
        currentSkillExecution: params.task.currentSkillExecution
      },
      actor: params.actor
    });
  }

  async applyApproval(
    taskId: string,
    dto: ApprovalActionDto,
    decision: (typeof ApprovalDecision)[keyof typeof ApprovalDecision]
  ): Promise<TaskRecord | undefined> {
    await this.initialize();
    return applyApprovalAction(
      {
        ...this.params,
        persistAndEmitTask: task => this.persistAndEmitTask(task)
      },
      taskId,
      dto,
      decision
    );
  }

  protected async handleInterruptTimeout(task: TaskRecord, now: string): Promise<TaskRecord | undefined> {
    return handleLifecycleInterruptTimeout(
      {
        addTrace: this.params.addTrace,
        addProgressDelta: this.params.addProgressDelta,
        transitionQueueState: this.params.transitionQueueState,
        runTaskPipeline: this.params.runTaskPipeline,
        persistAndEmitTask: currentTask => this.persistAndEmitTask(currentTask)
      },
      task,
      now
    );
  }
  buildFreshnessSourceSummary(task: TaskRecord): string | undefined {
    return buildFreshnessSourceSummary(task, isFreshnessSensitiveGoal(task.goal));
  }

  buildCitationSourceSummary(task: TaskRecord): string | undefined {
    return buildCitationSourceSummary(task);
  }

  describeActionIntent(intent: string): string {
    switch (intent) {
      case ActionIntent.WRITE_FILE:
        return '文件写入';
      case ActionIntent.DELETE_FILE:
        return '文件删除';
      case ActionIntent.SCHEDULE_TASK:
        return '定时任务';
      case ActionIntent.CALL_EXTERNAL_API:
        return '外部请求';
      case ActionIntent.READ_FILE:
        return '文件读取';
      default:
        return intent;
    }
  }

  recordAgentError(
    task: TaskRecord,
    error: unknown,
    context: {
      phase: 'task_pipeline' | 'approval_recovery' | 'background_runner';
      mode?: 'initial' | 'retry' | 'approval_resume';
      goal?: string;
      routeFlow?: string;
      toolName?: string;
      intent?: (typeof ActionIntent)[keyof typeof ActionIntent];
    }
  ): void {
    recordAgentError(task, error, context, {
      getMinistryLabel: this.params.getMinistryLabel,
      addTrace: (currentTask, node, summary, data) => this.params.addTrace(currentTask.trace, node, summary, data),
      addProgressDelta: (currentTask, content) => this.params.addProgressDelta(currentTask, content),
      upsertAgentState: (currentTask, state) =>
        this.params.upsertAgentState(currentTask, state as unknown as AgentExecutionState)
    });
  }

  appendDiagnosisEvidence(task: TaskRecord, review: ReviewRecord, executionSummary: string, finalAnswer: string) {
    appendDiagnosisEvidence(task, review, executionSummary, finalAnswer);
  }

  async persistRuntimeState(): Promise<void> {
    await persistLifecycleState({
      runtimeStateRepository: this.params.runtimeStateRepository,
      tasks: this.params.tasks,
      learningJobs: this.params.learningJobs,
      learningQueue: this.params.learningQueue,
      pendingExecutions: this.params.pendingExecutions
    });
  }

  emitTaskUpdate(task: TaskRecord): void {
    this.params.emitTaskUpdate(task);
  }

  async persistAndEmitTask(task: TaskRecord): Promise<void> {
    enforceInterruptControllerPolicy({
      task,
      addTrace: this.params.addTrace
    });
    finalizeLifecycleTaskState(task);
    this.upsertFreshnessEvidence(task);
    await this.persistRuntimeState();
    this.params.emitTaskUpdate(task);
  }

  private upsertFreshnessEvidence(task: TaskRecord): void {
    upsertLifecycleFreshnessEvidence(task, isFreshnessSensitiveGoal, this.buildFreshnessSourceSummary(task));
  }

  private async hydrateRuntimeState(): Promise<void> {
    await hydrateLifecycleState({
      runtimeStateRepository: this.params.runtimeStateRepository,
      tasks: this.params.tasks,
      learningJobs: this.params.learningJobs,
      learningQueue: this.params.learningQueue,
      pendingExecutions: this.params.pendingExecutions
    });
  }

  protected getBackgroundLifecycleDeps() {
    return {
      workerRegistry: this.params.workerRegistry,
      backgroundRuntime: this.params.backgroundRuntime,
      listTasks: () => this.listTasks(),
      initialize: () => this.initialize()
    };
  }
}
