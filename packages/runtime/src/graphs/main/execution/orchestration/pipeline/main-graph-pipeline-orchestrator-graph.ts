import { Command } from '@langchain/langgraph';
import type {
  CodeExecutionMinistryLike,
  DeliveryMinistryLike,
  OpsExecutionMinistryLike,
  ResearchMinistryLike,
  ReviewMinistryLike,
  RouterMinistryLike
} from '@agent/core';

import { buildDirectReplyInterruptGraph } from '../../pipeline/direct-reply-interrupt-graph';
import { buildTaskPipelineGraph } from '../../pipeline/main-graph-pipeline-graph';
import type { PendingExecutionContext } from '../../../../../flows/approval';
import { BingbuOpsMinistry, GongbuCodeMinistry } from '../../../../../bridges/coder-runtime-bridge';
import {
  HubuSearchMinistry,
  LibuDocsMinistry,
  LibuRouterMinistry
} from '../../../../../bridges/supervisor-runtime-bridge';
import { XingbuReviewMinistry as XingbuReviewMinistryImpl } from '../../../../../bridges/reviewer-runtime-bridge';
import type { RunTaskPipelineParams, TaskMode, TaskPipelineCallbacks } from './main-graph-pipeline-orchestrator.types';

export function createPipelineMinistries(
  callbacks: TaskPipelineCallbacks,
  taskId: string,
  goal: string
): {
  libu: RouterMinistryLike;
  hubu: ResearchMinistryLike;
  gongbu: CodeExecutionMinistryLike;
  bingbu: OpsExecutionMinistryLike;
  xingbu: ReviewMinistryLike;
  libuDocs: DeliveryMinistryLike;
} {
  return {
    libu: new LibuRouterMinistry(callbacks.createAgentContext(taskId, goal, 'chat')),
    hubu: new HubuSearchMinistry(callbacks.createAgentContext(taskId, goal, 'chat')),
    gongbu: new GongbuCodeMinistry(callbacks.createAgentContext(taskId, goal, 'chat')),
    bingbu: new BingbuOpsMinistry(callbacks.createAgentContext(taskId, goal, 'chat')),
    xingbu: new XingbuReviewMinistryImpl(callbacks.createAgentContext(taskId, goal, 'chat')),
    libuDocs: new LibuDocsMinistry(callbacks.createAgentContext(taskId, goal, 'chat'))
  };
}

export function createApprovalRecoveryMinistry(
  callbacks: Pick<TaskPipelineCallbacks, 'createAgentContext'>,
  taskId: string,
  goal: string
): CodeExecutionMinistryLike {
  return new GongbuCodeMinistry(callbacks.createAgentContext(taskId, goal, 'approval'));
}

export function buildDirectReplyGraphRunner(
  task: RunTaskPipelineParams['task'],
  libu: RouterMinistryLike,
  callbacks: TaskPipelineCallbacks
) {
  return buildDirectReplyInterruptGraph({
    task,
    libu,
    callbacks: {
      ensureTaskNotCancelled: callbacks.ensureTaskNotCancelled,
      attachTool: callbacks.attachTool,
      recordToolUsage: callbacks.recordToolUsage,
      addTrace: callbacks.addTrace,
      addProgressDelta: callbacks.addProgressDelta,
      setSubTaskStatus: callbacks.setSubTaskStatus,
      persistAndEmitTask: callbacks.persistAndEmitTask,
      transitionQueueState: callbacks.transitionQueueState,
      registerPendingExecution: callbacks.registerPendingExecution,
      resolveRuntimeSkillIntervention: callbacks.resolveRuntimeSkillIntervention,
      resolveSkillInstallInterruptResume: callbacks.resolveSkillInstallInterruptResume,
      runDirectReplyTask: callbacks.runDirectReplyTask
    },
    checkpointer: callbacks.getGraphCheckpointer()
  });
}

export function buildTaskPipelineRunner(
  params: Pick<RunTaskPipelineParams, 'task' | 'dto' | 'pendingExecutions' | 'llmConfigured' | 'sourcePolicyMode'> & {
    options: { mode: TaskMode; pending?: PendingExecutionContext };
    callbacks: TaskPipelineCallbacks;
    ministries: ReturnType<typeof createPipelineMinistries>;
  }
) {
  const { task, dto, options, ministries, pendingExecutions, llmConfigured, sourcePolicyMode, callbacks } = params;
  return buildTaskPipelineGraph({
    task,
    dto,
    options,
    ...ministries,
    pendingExecutions,
    llmConfigured,
    sourcePolicyMode,
    callbacks: {
      ensureTaskNotCancelled: callbacks.ensureTaskNotCancelled,
      syncTaskRuntime: callbacks.syncTaskRuntime,
      markSubgraph: callbacks.markSubgraph,
      markWorkerUsage: callbacks.markWorkerUsage,
      attachTool: callbacks.attachTool,
      recordToolUsage: callbacks.recordToolUsage,
      addTrace: callbacks.addTrace,
      addProgressDelta: callbacks.addProgressDelta,
      setSubTaskStatus: callbacks.setSubTaskStatus,
      addMessage: callbacks.addMessage,
      upsertAgentState: callbacks.upsertAgentState,
      persistAndEmitTask: callbacks.persistAndEmitTask,
      updateBudgetState: callbacks.updateBudgetState,
      transitionQueueState: callbacks.transitionQueueState,
      registerPendingExecution: callbacks.registerPendingExecution,
      resolveWorkflowRoutes: callbacks.resolveWorkflowRoutes,
      resolveResearchMinistry: callbacks.resolveResearchMinistry,
      resolveExecutionMinistry: callbacks.resolveExecutionMinistry,
      resolveReviewMinistry: callbacks.resolveReviewMinistry,
      getMinistryLabel: callbacks.getMinistryLabel,
      describeActionIntent: callbacks.describeActionIntent,
      createAgentContext: callbacks.createAgentContext,
      reviewExecution: callbacks.reviewExecution,
      persistReviewArtifacts: callbacks.persistReviewArtifacts,
      enqueueTaskLearning: callbacks.enqueueTaskLearning,
      shouldRunLibuDocsDelivery: callbacks.shouldRunLibuDocsDelivery,
      buildFreshnessSourceSummary: callbacks.buildFreshnessSourceSummary,
      buildCitationSourceSummary: callbacks.buildCitationSourceSummary,
      appendDiagnosisEvidence: callbacks.appendDiagnosisEvidence,
      recordDispatches: callbacks.recordDispatches,
      resolveRuntimeSkillIntervention: callbacks.resolveRuntimeSkillIntervention,
      resolveSkillInstallInterruptResume: callbacks.resolveSkillInstallInterruptResume
    },
    checkpointer: callbacks.getGraphCheckpointer()
  });
}

export async function resumeGraphWithCommand(
  graph: { invoke: (input: any, options?: any) => Promise<unknown> },
  threadId: string,
  resume: unknown
) {
  await graph.invoke(new Command({ resume }), {
    configurable: {
      thread_id: threadId
    }
  });
}
