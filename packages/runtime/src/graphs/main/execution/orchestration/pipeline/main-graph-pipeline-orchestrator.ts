import { TaskStatus, type CreateTaskDto } from '@agent/core';

import { TaskBudgetExceededError, TaskCancelledError } from '../../../tasking/runtime/main-graph-task-runtime-errors';
import { initializeTaskExecutionSteps } from '../../../../../bridges/supervisor-runtime-bridge';
import {
  buildDirectReplyGraphRunner,
  buildTaskPipelineRunner,
  createPipelineMinistries,
  resumeGraphWithCommand
} from './main-graph-pipeline-orchestrator-graph';
import type {
  ApprovalRecoveryCallbacks,
  RunTaskPipelineParams,
  TaskMode
} from './main-graph-pipeline-orchestrator.types';
import type { RuntimeTaskRecord as TaskRecord } from '../../../../../runtime/runtime-task.types';

export type {
  ApprovalRecoveryCallbacks,
  GraphTaskMode,
  RunTaskPipelineParams,
  TaskMode,
  TaskPipelineCallbacks
} from './main-graph-pipeline-orchestrator.types';

export async function runTaskPipelineWithGraph(params: RunTaskPipelineParams): Promise<void> {
  const { task, dto, options, pendingExecutions, llmConfigured, sourcePolicyMode, callbacks } = params;
  const graphMode: TaskMode = options.mode === 'interrupt_resume' ? 'initial' : options.mode;

  if (options.mode === 'interrupt_resume' && options.resume) {
    await resumeInterruptedTaskPipeline({
      task,
      dto,
      callbacks,
      graphMode,
      pendingExecutions,
      llmConfigured,
      sourcePolicyMode,
      resume: options.resume
    });
    await callbacks.persistAndEmitTask(task);
    return;
  }

  await prepareTaskPipelineRun(task, callbacks);
  const ministries = createPipelineMinistries(callbacks, task.id, dto.goal);

  try {
    callbacks.ensureTaskNotCancelled(task);
    const workflowRoute = callbacks.resolveTaskFlow(task, dto.goal, graphMode);
    task.chatRoute = workflowRoute;
    initializeTaskExecutionSteps(task);
    callbacks.addTrace(task, 'route', `聊天入口已选择 ${workflowRoute.flow} 流程。`, {
      adapter: workflowRoute.adapter,
      priority: workflowRoute.priority,
      reason: workflowRoute.reason,
      flow: workflowRoute.flow,
      graph: workflowRoute.graph
    });
    await callbacks.persistAndEmitTask(task);

    if (workflowRoute.flow === 'direct-reply') {
      const graph = buildDirectReplyGraphRunner(task, ministries.libu, callbacks);
      await graph.invoke(
        {
          taskId: task.id,
          goal: dto.goal,
          blocked: false,
          finalAnswer: undefined
        },
        {
          configurable: {
            thread_id: callbacks.resolveGraphThreadId(task)
          }
        }
      );
      await callbacks.persistAndEmitTask(task);
      return;
    }

    const graph = buildTaskPipelineRunner({
      task,
      dto,
      options: { mode: graphMode, pending: options.pending },
      ministries,
      pendingExecutions,
      llmConfigured,
      sourcePolicyMode,
      callbacks
    });

    await graph.invoke(
      callbacks.createGraphStartState(task, dto, ministries.libu, { mode: graphMode, pending: options.pending }),
      {
        configurable: {
          thread_id: callbacks.resolveGraphThreadId(task)
        }
      }
    );
    await callbacks.persistAndEmitTask(task);
  } catch (error) {
    await handleTaskPipelineError(task, dto, graphMode, callbacks, error);
  }
}

export async function runApprovalRecoveryPipelineWithGraph(params: {
  task: TaskRecord;
  dto: CreateTaskDto;
  pending: import('../../../../../flows/approval').PendingExecutionContext;
  callbacks: ApprovalRecoveryCallbacks;
}): Promise<void> {
  const { task, dto, pending, callbacks } = params;

  try {
    await callbacks.runApprovalRecoveryPipeline(task, dto, pending);
  } catch (error) {
    if (error instanceof TaskCancelledError) {
      await callbacks.persistAndEmitTask(task);
      return;
    }
    callbacks.recordAgentError(task, error, {
      phase: 'approval_recovery',
      mode: 'approval_resume',
      goal: dto.goal,
      toolName: pending.toolName,
      intent: pending.intent
    });
    task.status = TaskStatus.FAILED;
    callbacks.transitionQueueState(task, 'failed');
    task.currentNode = 'approval_recovery_failed';
    task.currentStep = 'agent_error';
    task.result = error instanceof Error ? error.message : 'Approval recovery failed';
    task.updatedAt = new Date().toISOString();
    await callbacks.persistAndEmitTask(task);
    throw error;
  }
}

async function resumeInterruptedTaskPipeline(params: {
  task: TaskRecord;
  dto: CreateTaskDto;
  callbacks: RunTaskPipelineParams['callbacks'];
  graphMode: TaskMode;
  pendingExecutions: RunTaskPipelineParams['pendingExecutions'];
  llmConfigured: boolean;
  sourcePolicyMode: RunTaskPipelineParams['sourcePolicyMode'];
  resume: NonNullable<RunTaskPipelineParams['options']['resume']>;
}) {
  const { task, dto, callbacks, graphMode, pendingExecutions, llmConfigured, sourcePolicyMode, resume } = params;
  const interruptStage =
    task.activeInterrupt?.payload && typeof task.activeInterrupt.payload === 'object'
      ? (task.activeInterrupt.payload as { stage?: unknown }).stage
      : undefined;
  const ministries = createPipelineMinistries(callbacks, task.id, dto.goal);

  if (interruptStage === 'direct_reply') {
    const graph = buildDirectReplyGraphRunner(task, ministries.libu, callbacks);
    await resumeGraphWithCommand(graph, callbacks.resolveGraphThreadId(task), resume);
    return;
  }

  const graph = buildTaskPipelineRunner({
    task,
    dto,
    options: { mode: graphMode },
    ministries,
    pendingExecutions,
    llmConfigured,
    sourcePolicyMode,
    callbacks
  });
  await resumeGraphWithCommand(graph, callbacks.resolveGraphThreadId(task), resume);
}

async function prepareTaskPipelineRun(task: TaskRecord, callbacks: RunTaskPipelineParams['callbacks']) {
  task.status = TaskStatus.RUNNING;
  callbacks.transitionQueueState(task, 'running');
  task.skillStage = 'preset_plan_expansion';
  task.currentNode = 'supervisor_plan';
  task.updatedAt = new Date().toISOString();
  callbacks.addTrace(
    task,
    'skill_stage_started',
    `流程模板 ${task.resolvedWorkflow?.displayName ?? '通用协作'} 进入计划展开阶段。`,
    {
      skillId: task.skillId,
      skillStage: task.skillStage
    }
  );
  task.result = undefined;
  await callbacks.persistAndEmitTask(task);
}

async function handleTaskPipelineError(
  task: TaskRecord,
  dto: CreateTaskDto,
  graphMode: TaskMode,
  callbacks: RunTaskPipelineParams['callbacks'],
  error: unknown
) {
  if (error instanceof TaskCancelledError) {
    await callbacks.persistAndEmitTask(task);
    return;
  }
  if (error instanceof TaskBudgetExceededError) {
    task.status = TaskStatus.BLOCKED;
    callbacks.transitionQueueState(task, 'blocked');
    task.currentNode = 'budget_governance';
    task.currentStep = 'budget_exhausted';
    task.result = error.message;
    task.updatedAt = new Date().toISOString();
    callbacks.addTrace(task, 'budget_exhausted', error.message, error.detail);
    callbacks.addProgressDelta(task, error.message);
    await callbacks.persistAndEmitTask(task);
    return;
  }
  const message = error instanceof Error ? error.message : 'Agent pipeline failed';
  callbacks.recordAgentError(task, error, {
    phase: 'task_pipeline',
    mode: graphMode,
    goal: dto.goal,
    routeFlow: task.chatRoute?.flow
  });
  task.status = TaskStatus.FAILED;
  callbacks.transitionQueueState(task, 'failed');
  task.currentNode = 'agent_error_boundary';
  task.currentStep = 'agent_error';
  task.result = message;
  task.updatedAt = new Date().toISOString();
  await callbacks.persistAndEmitTask(task);
  throw error;
}
