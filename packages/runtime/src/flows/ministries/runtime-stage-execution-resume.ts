import { AgentRole, ApprovalDecision, type CodeExecutionMinistryLike } from '@agent/core';
import { markExecutionStepCompleted } from '@agent/agents-supervisor';

import { executeApprovedAction } from '../approval';
import type { RuntimeTaskRecord as TaskRecord } from '../../runtime/runtime-task.types';
import type { RuntimeAgentGraphState } from '../../types/chat-graph';
import { appendExecutionEvidence, completeSkillStep } from './runtime-stage-helpers';
import type { PipelineRuntimeCallbacks } from './runtime-stage-types';

export async function resumeApprovedExecution(params: {
  task: TaskRecord;
  dtoGoal: string;
  state: RuntimeAgentGraphState;
  executionMinistry: string;
  gongbu: CodeExecutionMinistryLike;
  callbacks: PipelineRuntimeCallbacks;
}): Promise<Partial<RuntimeAgentGraphState>> {
  const { task, dtoGoal, state, executionMinistry, gongbu, callbacks } = params;
  const approvedResult = await executeApprovedAction(callbacks.createAgentContext(task.id, dtoGoal, 'approval'), {
    taskId: task.id,
    intent: state.toolIntent!,
    toolName: state.toolName!,
    researchSummary: state.researchSummary ?? '',
    toolInput: state.pendingToolInput
  });
  callbacks.ensureTaskNotCancelled(task);
  callbacks.upsertAgentState(
    task,
    gongbu.buildApprovedState(approvedResult, {
      taskId: task.id,
      intent: state.toolIntent!,
      toolName: state.toolName!,
      researchSummary: state.researchSummary ?? '',
      toolInput: state.pendingToolInput
    })
  );
  callbacks.addMessage(task, 'execution_result', approvedResult.outputSummary, AgentRole.EXECUTOR);
  callbacks.attachTool(task, {
    toolName: state.toolName!,
    attachedBy: 'workflow',
    preferred: true,
    reason: approvedResult.outputSummary,
    ownerType: 'ministry-owned',
    ownerId: task.currentMinistry ?? executionMinistry
  });
  callbacks.recordToolUsage(task, {
    toolName: state.toolName!,
    status: 'approved',
    requestedBy: task.currentMinistry ?? executionMinistry,
    reason: approvedResult.outputSummary,
    serverId: approvedResult.serverId,
    capabilityId: approvedResult.capabilityId,
    approvalRequired: false
  });
  callbacks.recordToolUsage(task, {
    toolName: state.toolName!,
    status: 'completed',
    requestedBy: task.currentMinistry ?? executionMinistry,
    reason: approvedResult.outputSummary,
    serverId: approvedResult.serverId,
    capabilityId: approvedResult.capabilityId,
    approvalRequired: false
  });
  appendExecutionEvidence(task, state.toolName!, approvedResult);
  task.sandboxState = {
    ...(task.sandboxState ?? {
      node: 'sandbox',
      stage:
        executionMinistry === 'bingbu-ops' ? 'bingbu' : executionMinistry === 'libu-delivery' ? 'review' : 'gongbu',
      attempt: (task.microLoopCount ?? 0) + 1,
      maxAttempts: task.maxMicroLoops ?? 2,
      updatedAt: new Date().toISOString()
    }),
    status: 'passed',
    verdict: 'safe',
    updatedAt: new Date().toISOString()
  };
  callbacks.addTrace(task, 'execute', approvedResult.outputSummary, {
    ministry: task.currentMinistry,
    intent: state.toolIntent,
    toolName: state.toolName,
    approved: true,
    serverId: approvedResult.serverId,
    capabilityId: approvedResult.capabilityId,
    transportUsed: approvedResult.transportUsed,
    fallbackUsed: approvedResult.fallbackUsed,
    exitCode: approvedResult.exitCode,
    ...(approvedResult.rawOutput && typeof approvedResult.rawOutput === 'object'
      ? (approvedResult.rawOutput as Record<string, unknown>)
      : {})
  });
  completeSkillStep(task, 'execute');
  callbacks.setSubTaskStatus(task, AgentRole.EXECUTOR, 'completed');
  markExecutionStepCompleted(task, 'execution', approvedResult.outputSummary);
  callbacks.addTrace(task, 'ministry_reported', '工部已提交执行结果。', {
    ministry: task.currentMinistry,
    workerId: task.currentWorker
  });
  callbacks.addProgressDelta(task, `执行结果：${approvedResult.outputSummary}`, AgentRole.EXECUTOR);
  await callbacks.persistAndEmitTask(task);
  return {
    currentStep: 'execute',
    approvalRequired: false,
    approvalStatus: ApprovalDecision.APPROVED,
    executionSummary: approvedResult.outputSummary,
    executionResult: approvedResult,
    finalAnswer: approvedResult.outputSummary,
    resumeFromApproval: false,
    shouldRetry: false
  };
}
