import { NotFoundException } from '@nestjs/common';
import type { RuntimeStateSnapshot } from '@agent/memory';

import {
  AgentExecutionState,
  AgentMessageRecord,
  ApprovalActionDto,
  ApprovalDecision,
  CreateAgentDiagnosisTaskDto,
  CreateDocumentLearningJobDto,
  CreateResearchLearningJobDto,
  CreateTaskDto,
  LocalSkillSuggestionRecord,
  ManagerPlan,
  ReviewRecord,
  TaskRecord
} from '@agent/core';

import { buildTaskAudit, buildFallbackTaskPlan } from '../domain/tasks/runtime-task-audit';
import { buildAgentDiagnosisTaskInput } from '../domain/tasks/runtime-task-diagnosis';
import { assertTaskActionResult, buildRecentTraceSummaryLines } from '../domain/tasks/runtime-task-service-helpers';

type ApprovalDecisionValue = (typeof ApprovalDecision)[keyof typeof ApprovalDecision];
type TaskSkillSuggestionsResult = {
  capabilityGapDetected: boolean;
  suggestions: LocalSkillSuggestionRecord[];
  triggerReason?: string;
  remoteSearch?: {
    query: string;
    discoverySource: string;
    executedAt: string;
    results: LocalSkillSuggestionRecord[];
  };
};
export interface RuntimeLearningJobRecord {
  id: string;
  sourceType: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  documentUri: string;
  goal?: string;
  summary?: string;
  persistedMemoryIds?: string[];
  conflictDetected?: boolean;
  createdAt: string;
  updatedAt: string;
}

interface RuntimeTaskOrchestrator {
  describeGraph(): string[];
  createTask(dto: CreateTaskDto): Promise<TaskRecord>;
  listTasks(): TaskRecord[];
  listPendingApprovals(): TaskRecord[];
  getTask(taskId: string): TaskRecord | undefined;
  getTaskAgents(taskId: string): AgentExecutionState[];
  getTaskMessages(taskId: string): AgentMessageRecord[];
  getTaskPlan(taskId: string): ManagerPlan | undefined;
  getTaskReview(taskId: string): ReviewRecord | undefined;
  retryTask(taskId: string): Promise<TaskRecord | undefined>;
  applyApproval(
    taskId: string,
    dto: ApprovalActionDto,
    decision: ApprovalDecisionValue
  ): Promise<TaskRecord | undefined>;
  createDocumentLearningJob(dto: CreateDocumentLearningJobDto): Promise<RuntimeLearningJobRecord>;
  createResearchLearningJob(dto: CreateResearchLearningJobDto): Promise<RuntimeLearningJobRecord>;
  getLearningJob(jobId: string): RuntimeLearningJobRecord | undefined;
}

export interface RuntimeTaskContext {
  orchestrator: RuntimeTaskOrchestrator;
  runtimeStateRepository: {
    load(): Promise<RuntimeStateSnapshot>;
  };
  resolveTaskSkillSuggestions: (
    goal: string,
    options?: { usedInstalledSkills?: string[]; limit?: number }
  ) => Promise<TaskSkillSuggestionsResult>;
}

export class RuntimeTaskService {
  constructor(private readonly getContext: () => RuntimeTaskContext) {}

  describeGraph() {
    return this.ctx().orchestrator.describeGraph();
  }

  createTask(dto: CreateTaskDto) {
    return this.ctx().orchestrator.createTask(dto);
  }

  createAgentDiagnosisTask(dto: CreateAgentDiagnosisTaskDto) {
    const task = this.getTask(dto.taskId);
    const recentTraceLines = buildRecentTraceSummaryLines(task);

    return this.ctx().orchestrator.createTask(buildAgentDiagnosisTaskInput(dto, task, recentTraceLines));
  }

  listTasks() {
    return this.ctx().orchestrator.listTasks();
  }

  listPendingApprovals() {
    return this.ctx().orchestrator.listPendingApprovals();
  }

  getTask(taskId: string) {
    const task = this.ctx().orchestrator.getTask(taskId);
    if (!task) {
      throw new NotFoundException(`Task ${taskId} not found`);
    }
    return task;
  }

  listTaskTraces(taskId: string) {
    return this.getTask(taskId).trace;
  }

  async getTaskAudit(taskId: string) {
    const task = this.getTask(taskId);
    const snapshot = await this.ctx().runtimeStateRepository.load();
    return buildTaskAudit(taskId, task, snapshot);
  }

  listTaskAgents(taskId: string) {
    this.getTask(taskId);
    return this.ctx().orchestrator.getTaskAgents(taskId);
  }

  listTaskMessages(taskId: string) {
    this.getTask(taskId);
    return this.ctx().orchestrator.getTaskMessages(taskId);
  }

  getTaskPlan(taskId: string) {
    const task = this.getTask(taskId);
    const plan = this.ctx().orchestrator.getTaskPlan(taskId);
    if (!plan) {
      return buildFallbackTaskPlan(task);
    }
    return plan;
  }

  async getTaskLocalSkillSuggestions(taskId: string) {
    const task = this.getTask(taskId);
    return this.ctx().resolveTaskSkillSuggestions(task.goal, {
      usedInstalledSkills: task.usedInstalledSkills,
      limit: 6
    });
  }

  getTaskReview(taskId: string) {
    this.getTask(taskId);
    return this.ctx().orchestrator.getTaskReview(taskId) ?? null;
  }

  retryTask(taskId: string) {
    return this.ctx()
      .orchestrator.retryTask(taskId)
      .then(task => assertTaskActionResult(taskId, task));
  }

  approveTaskAction(taskId: string, dto: ApprovalActionDto) {
    return this.ctx()
      .orchestrator.applyApproval(taskId, dto, ApprovalDecision.APPROVED)
      .then(task => assertTaskActionResult(taskId, task));
  }

  rejectTaskAction(taskId: string, dto: ApprovalActionDto) {
    return this.ctx()
      .orchestrator.applyApproval(taskId, dto, ApprovalDecision.REJECTED)
      .then(task => assertTaskActionResult(taskId, task));
  }

  createDocumentLearningJob(dto: CreateDocumentLearningJobDto) {
    return this.ctx().orchestrator.createDocumentLearningJob(dto);
  }

  createResearchLearningJob(dto: CreateResearchLearningJobDto) {
    return this.ctx().orchestrator.createResearchLearningJob(dto);
  }

  getLearningJob(jobId: string) {
    const job = this.ctx().orchestrator.getLearningJob(jobId);
    if (!job) {
      throw new NotFoundException(`Learning job ${jobId} not found`);
    }
    return job;
  }

  private ctx() {
    return this.getContext();
  }
}
