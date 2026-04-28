import {
  AgentRole,
  type AgentRoleValue,
  ApprovalDecision,
  CreateTaskDto,
  QueueStateRecord,
  ReviewRecord,
  TaskStatus
} from '@agent/core';
import type { EvaluationResult } from '@agent/knowledge';
import type { WorkflowPresetDefinition } from '@agent/core';
import type {
  CodeExecutionMinistryLike,
  MinistryContractMeta,
  ReviewMinistryLike,
  RouterMinistryLike
} from '@agent/core';
import { getMinistryDisplayName } from '../../../../../runtime/runtime-architecture-helpers';
import { normalizeRuntimeSpecialistFinding } from '../../../../../runtime/runtime-review-records';
import { markExecutionStepCompleted, markExecutionStepResumed } from '../../../../../bridges/supervisor-runtime-bridge';

import { buildMinistryStagePreferences } from '../../../../../capabilities/capability-pool';
import { executeApprovedAction, PendingExecutionContext } from '../../../../../flows/approval';
import {
  createApprovalRecoveryGraph,
  type ApprovalRecoveryGraphState
} from '../../../../approval/approval-recovery.graph';
import type { RuntimeTaskRecord } from '../../../../../runtime/runtime-task.types';
import { TaskCancelledError } from '../../../tasking/runtime/main-graph-task-runtime-errors';
import type { RuntimeAgentGraphState } from '../../../../../types/chat-graph';
import { createInitialState } from '../../../../chat/chat.graph';
import type { ApprovalResumeInput } from '@agent/runtime';

export class MainGraphExecutionHelpers {
  constructor(
    private readonly createAgentContext: (taskId: string, goal: string, flow: 'chat' | 'approval' | 'learning') => any,
    private readonly persistAndEmitTask: (task: RuntimeTaskRecord) => Promise<void>,
    private readonly ensureTaskNotCancelled: (task: RuntimeTaskRecord) => void,
    private readonly syncTaskRuntime: (
      task: RuntimeTaskRecord,
      state: Pick<RuntimeAgentGraphState, 'currentStep' | 'retryCount' | 'maxRetries'>
    ) => void,
    private readonly transitionQueueState: (task: RuntimeTaskRecord, status: QueueStateRecord['status']) => void,
    private readonly setSubTaskStatus: (
      task: RuntimeTaskRecord,
      role: AgentRoleValue,
      status: 'pending' | 'running' | 'completed' | 'blocked'
    ) => void,
    private readonly upsertAgentState: (task: RuntimeTaskRecord, nextState: any) => void,
    private readonly addMessage: (
      task: RuntimeTaskRecord,
      type: 'summary' | 'review_result' | 'execution_result',
      content: string,
      from: AgentRoleValue
    ) => void,
    private readonly addTrace: (
      task: RuntimeTaskRecord,
      node: string,
      summary: string,
      data?: Record<string, unknown>
    ) => void,
    private readonly addProgressDelta: (task: RuntimeTaskRecord, content: string, from?: AgentRoleValue) => void,
    private readonly createApprovalRecoveryMinistry: (taskId: string, goal: string) => CodeExecutionMinistryLike,
    private readonly getRunTaskPipeline: () => (
      task: RuntimeTaskRecord,
      dto: CreateTaskDto,
      options: {
        mode: 'initial' | 'retry' | 'approval_resume' | 'interrupt_resume';
        pending?: PendingExecutionContext;
        resume?: ApprovalResumeInput;
      }
    ) => Promise<void>
  ) {}

  async runDirectReplyTask(task: RuntimeTaskRecord, libu: RouterMinistryLike): Promise<void> {
    this.syncTaskRuntime(task, {
      currentStep: 'direct_reply',
      retryCount: task.retryCount ?? 0,
      maxRetries: task.maxRetries ?? 1
    });
    task.currentNode = 'finalize_response';
    this.addTrace(task, 'direct_reply', 'Manager replied directly without invoking full multi-agent pipeline.');
    const answer = await libu.replyDirectly();
    this.upsertAgentState(task, libu.getState());
    const directReplyFallbackNotes = libu
      .getState()
      .observations.filter(note => note.startsWith('LLM '))
      .slice(-3);
    if (directReplyFallbackNotes.length > 0) {
      this.addTrace(task, 'direct_reply_fallback', '首辅直答未获得模型正常输出，已回退到本地兜底回复。', {
        notes: directReplyFallbackNotes
      });
    }
    task.result = answer;
    markExecutionStepCompleted(task, 'delivery', '首辅已直接完成最终答复。', 'libu-docs');
    task.status = TaskStatus.COMPLETED;
    this.transitionQueueState(task, 'completed');
    task.skillStage = 'completed';
    task.updatedAt = new Date().toISOString();
    task.review = {
      taskId: task.id,
      decision: 'approved',
      notes: ['Direct reply mode for conversational identity request.'],
      createdAt: new Date().toISOString()
    };
    task.messages.push({
      id: `msg_${Date.now()}_${task.messages.length}`,
      taskId: task.id,
      from: AgentRole.MANAGER,
      to: AgentRole.MANAGER,
      type: 'summary',
      content: answer,
      createdAt: new Date().toISOString()
    });
    this.addTrace(
      task,
      'skill_stage_completed',
      `流程模板 ${task.resolvedWorkflow?.displayName ?? '通用协作'} 已直接完成。`,
      {
        skillId: task.skillId,
        skillStage: task.skillStage,
        outputType: task.resolvedWorkflow?.outputContract.type
      }
    );
    this.addTrace(task, 'final_response_completed', '首辅已直接完成最终答复。', {
      currentNode: task.currentNode
    });
    await this.persistAndEmitTask(task);
  }

  async runApprovalRecoveryPipeline(
    task: RuntimeTaskRecord,
    dto: CreateTaskDto,
    pending: PendingExecutionContext
  ): Promise<void> {
    task.status = TaskStatus.RUNNING;
    this.transitionQueueState(task, 'running');
    task.currentNode = 'resume_after_approval';
    task.updatedAt = new Date().toISOString();
    markExecutionStepResumed(task, 'recovery', '进入审批恢复链。', 'system');
    if (pending.currentSkillExecution) {
      task.currentSkillExecution = {
        ...pending.currentSkillExecution,
        updatedAt: task.updatedAt
      };
    }
    this.addTrace(task, 'run_resumed', '皇帝已批准高风险动作，流程恢复执行。', {
      runId: task.runId,
      currentSkillExecution: pending.currentSkillExecution
    });
    await this.persistAndEmitTask(task);

    const gongbu = this.createApprovalRecoveryMinistry(task.id, dto.goal);
    try {
      const graph = createApprovalRecoveryGraph({
        executeApproved: async (state: ApprovalRecoveryGraphState) => {
          this.ensureTaskNotCancelled(task);
          this.syncTaskRuntime(task, {
            currentStep: 'execute',
            retryCount: task.retryCount ?? 0,
            maxRetries: task.maxRetries ?? 1
          });
          this.setSubTaskStatus(task, AgentRole.EXECUTOR, 'running');
          const executionResult = await executeApprovedAction(
            this.createAgentContext(task.id, dto.goal, 'approval'),
            state.pending
          );
          this.ensureTaskNotCancelled(task);
          this.upsertAgentState(task, gongbu.buildApprovedState(executionResult, state.pending));
          this.addMessage(task, 'execution_result', executionResult.outputSummary, AgentRole.EXECUTOR);
          this.addTrace(task, 'execute', executionResult.outputSummary, {
            ministry: 'gongbu-code',
            intent: state.pending.intent,
            toolName: state.pending.toolName,
            approved: true,
            serverId: executionResult.serverId,
            capabilityId: executionResult.capabilityId,
            transportUsed: executionResult.transportUsed,
            fallbackUsed: executionResult.fallbackUsed,
            exitCode: executionResult.exitCode,
            ...(executionResult.rawOutput && typeof executionResult.rawOutput === 'object'
              ? (executionResult.rawOutput as Record<string, unknown>)
              : {})
          });
          this.setSubTaskStatus(task, AgentRole.EXECUTOR, 'completed');
          await this.persistAndEmitTask(task);
          return {
            ...state,
            approvalStatus: ApprovalDecision.APPROVED,
            executionResult,
            executionSummary: executionResult.outputSummary
          };
        },
        finish: async (state: ApprovalRecoveryGraphState) => {
          this.ensureTaskNotCancelled(task);
          await this.getRunTaskPipeline()(task, dto, { mode: 'approval_resume', pending });
          return state;
        }
      }).compile();

      await graph.invoke({
        taskId: task.id,
        goal: dto.goal,
        pending,
        approvalStatus: ApprovalDecision.APPROVED
      });
    } catch (error) {
      if (error instanceof TaskCancelledError) {
        await this.persistAndEmitTask(task);
        return;
      }
      throw error;
    }
  }

  createGraphStartState(
    task: RuntimeTaskRecord,
    dto: CreateTaskDto,
    libu: RouterMinistryLike,
    options: { mode: 'initial' | 'retry' | 'approval_resume' | 'interrupt_resume'; pending?: PendingExecutionContext }
  ): RuntimeAgentGraphState {
    const base = createInitialState(task.id, dto.goal, dto.context);
    if (options.mode !== 'approval_resume' || !options.pending) {
      return base;
    }
    return {
      ...base,
      currentPlan: task.plan?.steps ?? [],
      dispatches: task.plan ? libu.dispatch(task.plan) : [],
      researchSummary: options.pending.researchSummary,
      toolIntent: options.pending.intent,
      toolName: options.pending.toolName,
      pendingToolInput: options.pending.toolInput,
      approvalRequired: false,
      approvalStatus: ApprovalDecision.APPROVED,
      resumeFromApproval: true
    };
  }

  async reviewExecution(
    task: RuntimeTaskRecord,
    xingbu: ReviewMinistryLike,
    executionResult: RuntimeAgentGraphState['executionResult'],
    executionSummary: string
  ): Promise<{
    review: ReviewRecord;
    evaluation: EvaluationResult;
    critiqueResult?: RuntimeTaskRecord['critiqueResult'];
    specialistFinding?: NonNullable<RuntimeTaskRecord['specialistFindings']>[number];
    contractMeta: MinistryContractMeta;
  }> {
    this.setSubTaskStatus(task, AgentRole.REVIEWER, 'running');
    const reviewed = await xingbu.review(executionResult, executionSummary);
    task.review = reviewed.review;
    this.upsertAgentState(task, xingbu.getState());
    this.addMessage(task, 'review_result', reviewed.review.notes.join(' '), AgentRole.REVIEWER);
    this.addTrace(task, 'review', `Reviewer decision: ${reviewed.review.decision}`, {
      status: reviewed.contractMeta.parseStatus === 'success' ? 'success' : 'failed',
      isFallback: reviewed.contractMeta.fallbackUsed,
      fallbackReason: reviewed.contractMeta.fallbackReason,
      contractName: reviewed.contractMeta.contractName,
      contractVersion: reviewed.contractMeta.contractVersion,
      parseStatus: reviewed.contractMeta.parseStatus
    });
    this.setSubTaskStatus(task, AgentRole.REVIEWER, 'completed');
    return {
      ...reviewed,
      specialistFinding: reviewed.specialistFinding
        ? (normalizeRuntimeSpecialistFinding(
            reviewed.specialistFinding as Parameters<typeof normalizeRuntimeSpecialistFinding>[0]
          ) as NonNullable<RuntimeTaskRecord['specialistFindings']>[number])
        : undefined
    };
  }

  resolveResearchMinistry(
    task: RuntimeTaskRecord,
    workflow?: WorkflowPresetDefinition
  ): 'hubu-search' | 'libu-delivery' {
    return buildMinistryStagePreferences({
      capabilityAttachments: task.capabilityAttachments,
      capabilityAugmentations: task.capabilityAugmentations,
      requestedHints: task.requestedHints,
      specialistLead: task.specialistLead,
      skillSearch: task.skillSearch,
      pendingApproval: task.pendingApproval,
      resolvedWorkflow: workflow
    }).research;
  }

  resolveExecutionMinistry(
    task: RuntimeTaskRecord,
    workflow?: WorkflowPresetDefinition
  ): 'gongbu-code' | 'bingbu-ops' | 'libu-delivery' {
    return buildMinistryStagePreferences({
      capabilityAttachments: task.capabilityAttachments,
      capabilityAugmentations: task.capabilityAugmentations,
      requestedHints: task.requestedHints,
      specialistLead: task.specialistLead,
      skillSearch: task.skillSearch,
      pendingApproval: task.pendingApproval,
      resolvedWorkflow: workflow
    }).execution;
  }

  resolveReviewMinistry(
    task: RuntimeTaskRecord,
    workflow?: WorkflowPresetDefinition
  ): 'xingbu-review' | 'libu-delivery' {
    return buildMinistryStagePreferences({
      capabilityAttachments: task.capabilityAttachments,
      capabilityAugmentations: task.capabilityAugmentations,
      requestedHints: task.requestedHints,
      specialistLead: task.specialistLead,
      skillSearch: task.skillSearch,
      pendingApproval: task.pendingApproval,
      resolvedWorkflow: workflow
    }).review;
  }

  getMinistryLabel(ministry: string): string {
    return getMinistryDisplayName(ministry) ?? ministry;
  }
}
