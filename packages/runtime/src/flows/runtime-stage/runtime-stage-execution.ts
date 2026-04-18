import type {
  CodeExecutionMinistryLike,
  DeliveryMinistryLike,
  OpsExecutionMinistryLike,
  TaskRecord as CoreTaskRecord
} from '@agent/core';
import { AgentRole, ApprovalDecision } from '@agent/core';
import { normalizeExecutionMode } from '../../runtime/runtime-architecture-helpers';
import {
  markExecutionStepBlocked,
  markExecutionStepCompleted,
  markExecutionStepStarted
} from '../../bridges/supervisor-runtime-bridge';

import { PendingExecutionContext } from '../approval';
import { resolveCapabilityRedirect } from '../../capabilities/capability-pool';
import type { RuntimeTaskRecord as TaskRecord } from '../../runtime/runtime-task.types';
import type { RuntimeAgentGraphState } from '../../types/chat-graph';
import {
  announceSkillStep,
  appendExecutionEvidence,
  completeSkillStep,
  resolveExecutionDispatchObjective
} from './runtime-stage-helpers';
import { pauseExecutionForApproval } from './runtime-stage-execute';
import { resumeApprovedExecution } from './runtime-stage-execution-resume';
import type { PipelineRuntimeCallbacks } from './runtime-stage-types';

export async function runExecuteStage(
  task: TaskRecord,
  dtoGoal: string,
  state: RuntimeAgentGraphState,
  gongbu: CodeExecutionMinistryLike,
  bingbu: OpsExecutionMinistryLike,
  libuDocs: DeliveryMinistryLike,
  pendingExecutions: Map<string, PendingExecutionContext>,
  llmConfigured: boolean,
  callbacks: PipelineRuntimeCallbacks
): Promise<Partial<RuntimeAgentGraphState>> {
  callbacks.ensureTaskNotCancelled(task);
  markExecutionStepStarted(task, 'execution', '六部开始执行实施。');
  callbacks.syncTaskRuntime(task, {
    currentStep: 'execute',
    retryCount: state.retryCount,
    maxRetries: state.maxRetries
  });
  callbacks.markSubgraph(task, 'execution');
  const executionMinistry = callbacks.resolveExecutionMinistry(task, task.resolvedWorkflow);
  task.sandboxState = {
    node: 'sandbox',
    stage: executionMinistry === 'bingbu-ops' ? 'bingbu' : executionMinistry === 'libu-delivery' ? 'review' : 'gongbu',
    status: 'running',
    attempt: (task.microLoopCount ?? 0) + 1,
    maxAttempts: task.maxMicroLoops ?? 2,
    updatedAt: new Date().toISOString()
  };
  task.currentMinistry = executionMinistry;
  task.currentWorker = task.modelRoute?.find(item => item.ministry === executionMinistry)?.workerId;
  callbacks.markWorkerUsage(task, task.currentWorker);
  callbacks.addTrace(task, 'ministry_started', `${callbacks.getMinistryLabel(executionMinistry)}开始执行方案。`, {
    ministry: task.currentMinistry,
    workerId: task.currentWorker
  });
  callbacks.addProgressDelta(
    task,
    `${callbacks.getMinistryLabel(executionMinistry)}已接到任务，正在执行方案。`,
    AgentRole.EXECUTOR
  );
  callbacks.setSubTaskStatus(task, AgentRole.EXECUTOR, 'running');
  announceSkillStep(task, 'execute', callbacks);
  const executionMode = normalizeExecutionMode(task.executionMode ?? task.executionPlan?.mode);
  if (executionMode === 'plan') {
    const readonlySummary = '当前仍处于计划模式，六部执行链不会被打开；系统仅保留票拟、研究与只读整理结果。';
    task.mainChainNode = 'mode_gate';
    task.currentNode = 'planning_readonly_execute_blocked';
    callbacks.addTrace(task, 'mode_gate', '模式门阻止了 plan 模式下的六部执行。', {
      activeMode: 'plan',
      blockedStage: 'execute',
      currentMinistry: executionMinistry
    });
    callbacks.addProgressDelta(task, readonlySummary, AgentRole.EXECUTOR);
    callbacks.setSubTaskStatus(task, AgentRole.EXECUTOR, 'blocked');
    markExecutionStepBlocked(task, 'execution', '当前仍处于计划模式，执行链被模式门阻止。');
    task.sandboxState = {
      ...task.sandboxState,
      status: 'failed',
      verdict: 'unsafe',
      exhaustedReason: 'plan_mode_blocks_execute',
      updatedAt: new Date().toISOString()
    };
    await callbacks.persistAndEmitTask(task);
    return {
      currentStep: 'execute',
      approvalRequired: false,
      approvalStatus: ApprovalDecision.APPROVED,
      executionSummary: readonlySummary,
      executionResult: undefined,
      finalAnswer: readonlySummary,
      resumeFromApproval: false,
      shouldRetry: false
    };
  }

  const executionMinistryRunner = executionMinistry === 'bingbu-ops' ? bingbu : gongbu;

  if (state.resumeFromApproval && state.toolIntent && state.toolName) {
    return resumeApprovedExecution({
      task,
      dtoGoal,
      state,
      executionMinistry,
      gongbu,
      callbacks
    });
  }

  const execution =
    executionMinistry === 'libu-delivery'
      ? await libuDocs.execute(task as CoreTaskRecord, state.executionSummary ?? state.researchSummary ?? '')
      : await executionMinistryRunner.execute(
          resolveExecutionDispatchObjective(state.dispatches) ??
            (executionMinistry === 'bingbu-ops'
              ? 'Run controlled ops and validation tasks'
              : 'Execute the candidate action'),
          state.researchSummary ?? 'No research summary available.'
        );
  callbacks.ensureTaskNotCancelled(task);
  const capabilityRedirect = resolveCapabilityRedirect(task, execution.capabilityId ?? execution.toolName);
  if (
    capabilityRedirect.requestedTarget &&
    capabilityRedirect.requestedTarget !== capabilityRedirect.redirectedTarget
  ) {
    callbacks.addTrace(task, 'deprecated_redirect', '命中已弃用能力，已按兼容策略重定向到替代能力。', {
      requestedTarget: capabilityRedirect.requestedTarget,
      redirectedTarget: capabilityRedirect.redirectedTarget
    });
  }
  if (
    capabilityRedirect.requestedTarget &&
    capabilityRedirect.requestedTarget !== capabilityRedirect.redirectedTarget &&
    !capabilityRedirect.redirectAttachment
  ) {
    if (capabilityRedirect.requiresReadonlyFallback) {
      const fallbackSummary = `能力 ${capabilityRedirect.requestedTarget} 已弃用，但替代目标 ${capabilityRedirect.redirectedTarget} 当前不可用。已退回只读建议，不执行外部副作用。`;
      task.result = fallbackSummary;
      callbacks.addTrace(task, 'deprecated_redirect', fallbackSummary, {
        requestedTarget: capabilityRedirect.requestedTarget,
        redirectedTarget: capabilityRedirect.redirectedTarget,
        fallback: 'readonly-suggestion'
      });
      callbacks.addProgressDelta(task, fallbackSummary, AgentRole.EXECUTOR);
      markExecutionStepCompleted(task, 'execution', fallbackSummary);
      await callbacks.persistAndEmitTask(task);
      return {
        currentStep: 'execute',
        approvalRequired: false,
        approvalStatus: ApprovalDecision.APPROVED,
        executionSummary: fallbackSummary,
        executionResult: undefined,
        finalAnswer: fallbackSummary,
        resumeFromApproval: false,
        shouldRetry: false
      };
    }
    throw new Error(
      `Capability ${capabilityRedirect.requestedTarget} is deprecated in favor of ${capabilityRedirect.redirectedTarget}, but the replacement is unavailable.`
    );
  }
  callbacks.upsertAgentState(
    task,
    executionMinistry === 'libu-delivery' ? libuDocs.getState() : executionMinistryRunner.getState()
  );
  callbacks.addMessage(task, 'execution_result', execution.summary, AgentRole.EXECUTOR);
  callbacks.attachTool(task, {
    toolName: execution.toolName,
    attachedBy: 'workflow',
    preferred: true,
    reason: execution.summary,
    ownerType: 'ministry-owned',
    ownerId: task.currentMinistry ?? executionMinistry
  });
  callbacks.recordToolUsage(task, {
    toolName: execution.toolName,
    status: execution.requiresApproval ? 'blocked' : 'completed',
    requestedBy: task.currentMinistry ?? executionMinistry,
    reason: execution.summary,
    blockedReason: execution.requiresApproval ? execution.summary : undefined,
    serverId: execution.serverId,
    capabilityId: execution.capabilityId,
    approvalRequired: execution.requiresApproval,
    riskLevel: execution.tool?.riskLevel
  });
  appendExecutionEvidence(task, execution.toolName, execution.executionResult);
  callbacks.addTrace(task, 'execute', execution.summary, {
    ministry: task.currentMinistry,
    intent: execution.intent,
    toolName: execution.toolName,
    requiresApproval: execution.requiresApproval,
    llmConfigured,
    retryCount: state.retryCount,
    serverId: execution.executionResult?.serverId,
    capabilityId: execution.executionResult?.capabilityId,
    transportUsed: execution.executionResult?.transportUsed,
    fallbackUsed: execution.executionResult?.fallbackUsed,
    ...(execution.executionResult?.rawOutput && typeof execution.executionResult.rawOutput === 'object'
      ? (execution.executionResult.rawOutput as Record<string, unknown>)
      : {})
  });
  const approvalReasonCode =
    'approvalReasonCode' in execution && typeof execution.approvalReasonCode === 'string'
      ? execution.approvalReasonCode
      : undefined;
  if (approvalReasonCode === 'watchdog_timeout' || approvalReasonCode === 'watchdog_interaction_required') {
    callbacks.addTrace(task, 'node_progress', '兵部看门狗触发运行时治理中断。', {
      ministry: task.currentMinistry,
      toolName: execution.toolName,
      approvalReasonCode,
      serverId: execution.serverId,
      capabilityId: execution.capabilityId
    });
    callbacks.addProgressDelta(
      task,
      `兵部看门狗已触发：${execution.toolName} 出现停滞或交互阻塞，已转入运行时治理。`,
      AgentRole.EXECUTOR
    );
  }
  callbacks.addProgressDelta(task, `执行进展：${execution.summary}`, AgentRole.EXECUTOR);

  if (execution.requiresApproval) {
    markExecutionStepBlocked(task, 'approval-interrupt', execution.summary, '执行链已暂停等待审批。', 'system');
    task.sandboxState = {
      ...task.sandboxState,
      status: 'running',
      verdict: 'retry',
      updatedAt: new Date().toISOString()
    };
    pauseExecutionForApproval({
      task,
      pendingExecutions,
      researchSummary: state.researchSummary ?? '',
      execution: {
        intent: execution.intent,
        toolName: execution.toolName,
        summary: execution.summary,
        serverId: execution.serverId,
        capabilityId: execution.capabilityId,
        approvalReason:
          'approvalReason' in execution && typeof execution.approvalReason === 'string'
            ? execution.approvalReason
            : undefined,
        approvalReasonCode:
          'approvalReasonCode' in execution && typeof execution.approvalReasonCode === 'string'
            ? execution.approvalReasonCode
            : undefined,
        approvalPreview: execution.approvalPreview,
        tool: execution.tool
      },
      callbacks: {
        transitionQueueState: callbacks.transitionQueueState,
        setSubTaskStatus: callbacks.setSubTaskStatus,
        addTrace: callbacks.addTrace,
        addProgressDelta: callbacks.addProgressDelta,
        describeActionIntent: callbacks.describeActionIntent
      }
    });
  } else {
    completeSkillStep(task, 'execute');
    callbacks.setSubTaskStatus(task, AgentRole.EXECUTOR, 'completed');
    markExecutionStepCompleted(task, 'execution', execution.summary);
    task.sandboxState = {
      ...task.sandboxState,
      status: 'passed',
      verdict: 'safe',
      updatedAt: new Date().toISOString()
    };
  }

  await callbacks.persistAndEmitTask(task);
  return {
    currentStep: 'execute',
    toolIntent: execution.intent,
    toolName: execution.toolName,
    approvalRequired: execution.requiresApproval,
    approvalStatus: execution.requiresApproval ? 'pending' : ApprovalDecision.APPROVED,
    executionSummary: execution.summary,
    executionResult: execution.executionResult,
    finalAnswer: execution.summary,
    shouldRetry: false,
    resumeFromApproval: false
  };
}
