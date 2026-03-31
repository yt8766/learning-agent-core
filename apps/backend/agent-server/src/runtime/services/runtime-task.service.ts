import { NotFoundException } from '@nestjs/common';

import {
  ApprovalActionDto,
  ApprovalDecision,
  CreateAgentDiagnosisTaskDto,
  CreateDocumentLearningJobDto,
  CreateResearchLearningJobDto,
  CreateTaskDto
} from '@agent/shared';

import { buildTraceAnalytics } from '../helpers/runtime-analytics';
import { extractBrowserReplay } from '../helpers/runtime-connector-utils';

export interface RuntimeTaskContext {
  orchestrator: any;
  runtimeStateRepository: any;
  resolveTaskSkillSuggestions: (
    goal: string,
    options?: { usedInstalledSkills?: string[]; limit?: number }
  ) => Promise<unknown>;
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
    const traces = this.listTaskTraces(dto.taskId).slice(-5);
    const goal = [
      `请诊断任务 ${dto.taskId} 的 agent 错误并给出恢复方案。`,
      `原任务目标：${dto.goal ?? task.goal}`,
      `错误码：${dto.errorCode}`,
      dto.ministry ? `发生环节：${dto.ministry}` : '',
      task.currentNode ? `当前节点：${task.currentNode}` : '',
      task.currentStep ? `当前步骤：${task.currentStep}` : '',
      task.currentWorker ? `当前执行角色：${task.currentWorker}` : '',
      `错误信息：${dto.message}`,
      dto.diagnosisHint ? `已知诊断提示：${dto.diagnosisHint}` : '',
      dto.recommendedAction ? `当前建议动作：${dto.recommendedAction}` : '',
      dto.recoveryPlaybook?.length
        ? `建议恢复步骤：\n${dto.recoveryPlaybook.map((step, index) => `${index + 1}. ${step}`).join('\n')}`
        : '',
      traces.length
        ? `最近 Trace：\n${traces.map((trace: any) => `${trace.at} / ${trace.node} / ${trace.summary}`).join('\n')}`
        : '',
      dto.stack ? `异常堆栈：\n${dto.stack}` : '',
      '请按首辅/刑部视角分析根因，并说明应直接重试、切换 provider/connector，还是先修复状态或审批链路。'
    ]
      .filter(Boolean)
      .join('\n');

    return this.ctx().orchestrator.createTask({
      goal,
      context: `diagnosis_for:${dto.taskId}`,
      constraints: ['prefer-xingbu-diagnosis', 'preserve-trace-context']
    });
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
    const relatedGovernanceTargets = new Set<string>([
      ...(task.connectorRefs ?? []),
      ...(task.usedInstalledSkills ?? []),
      ...(task.usedCompanyWorkers ?? []),
      task.currentWorker ?? ''
    ]);
    const governanceEntries = (snapshot.governanceAudit ?? [])
      .filter((entry: any) => relatedGovernanceTargets.has(entry.targetId))
      .map((entry: any) => ({
        id: entry.id,
        at: entry.at,
        type: 'governance' as const,
        title: entry.action,
        summary: `${entry.scope}:${entry.targetId}`,
        detail: entry.reason,
        outcome: entry.outcome
      }));
    const traceEntries = task.trace.map((trace: any, index: number) => ({
      id: `${task.id}:trace:${index}`,
      at: trace.at,
      type: 'trace' as const,
      title: trace.node,
      summary: trace.summary,
      detail: trace.data
    }));
    const approvalEntries = task.approvals.map((approval: any, index: number) => ({
      id: `${task.id}:approval:${index}`,
      at: task.updatedAt,
      type: 'approval' as const,
      title: approval.intent,
      summary: approval.decision,
      detail: approval.reason
    }));
    const usageEntry = (snapshot.usageAudit ?? []).find((entry: any) => entry.taskId === taskId);
    const usageAuditEntries = usageEntry
      ? [
          {
            id: `${task.id}:usage`,
            at: usageEntry.updatedAt,
            type: 'usage' as const,
            title: 'usage-audit',
            summary: `${usageEntry.totalTokens} tokens / $${usageEntry.totalCostUsd.toFixed(4)}`,
            detail: usageEntry.modelBreakdown
          }
        ]
      : [];
    const browserReplays = task.trace
      .map((trace: any) => extractBrowserReplay(trace.data))
      .filter(Boolean)
      .map((replay: any) => ({
        sessionId: replay.sessionId,
        url: replay.url,
        artifactRef: replay.artifactRef,
        snapshotRef: replay.snapshotRef,
        screenshotRef: replay.screenshotRef,
        stepCount: replay.steps?.length ?? replay.stepTrace?.length ?? 0
      }));

    return {
      taskId,
      entries: [...traceEntries, ...approvalEntries, ...governanceEntries, ...usageAuditEntries].sort((left, right) =>
        right.at.localeCompare(left.at)
      ),
      browserReplays,
      traceSummary: buildTraceAnalytics(task.trace ?? [])
    };
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
      .then((task: any) => {
        if (!task) {
          throw new NotFoundException(`Task ${taskId} not found`);
        }
        return task;
      });
  }

  approveTaskAction(taskId: string, dto: ApprovalActionDto) {
    return this.ctx()
      .orchestrator.applyApproval(taskId, dto, ApprovalDecision.APPROVED)
      .then((task: any) => {
        if (!task) {
          throw new NotFoundException(`Task ${taskId} not found`);
        }
        return task;
      });
  }

  rejectTaskAction(taskId: string, dto: ApprovalActionDto) {
    return this.ctx()
      .orchestrator.applyApproval(taskId, dto, ApprovalDecision.REJECTED)
      .then((task: any) => {
        if (!task) {
          throw new NotFoundException(`Task ${taskId} not found`);
        }
        return task;
      });
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

function buildFallbackTaskPlan(task: any) {
  const traceSteps = (task.trace ?? [])
    .map((trace: any) => trace?.summary?.trim())
    .filter(Boolean)
    .slice(0, 4);
  const routeSummary =
    task.chatRoute?.flow === 'direct-reply'
      ? '本轮命中 direct-reply 路线，由首辅直接结合会话上下文完成回答。'
      : task.currentStep
        ? `本轮当前处于 ${task.currentStep} 阶段。`
        : '本轮未生成显式结构化计划，当前展示执行回放摘要。';
  const steps = traceSteps.length ? traceSteps : [routeSummary];

  return {
    id: `fallback-plan:${task.id}`,
    summary: routeSummary,
    steps,
    subTasks: [
      {
        id: `${task.id}:fallback-subtask`,
        title: task.chatRoute?.flow === 'direct-reply' ? '会话直答' : '执行摘要',
        description: routeSummary,
        assignedTo: task.currentMinistry ?? 'manager',
        status: task.status ?? 'completed'
      }
    ]
  };
}
