import type { CreateTaskDto } from '@agent/core';
import { markExecutionStepCompleted } from '../../workflows/execution-steps';
import type { RuntimeAgentGraphState } from '../../types/chat-graph';
import type { PlanningCallbacks, SupervisorPlanningTaskLike } from './pipeline-stage-node.types';

export async function runGoalIntakeStage<TTask extends SupervisorPlanningTaskLike>(
  task: TTask,
  dto: CreateTaskDto,
  state: RuntimeAgentGraphState,
  mode: 'initial' | 'retry' | 'approval_resume',
  callbacks: PlanningCallbacks<TTask>
): Promise<Partial<RuntimeAgentGraphState>> {
  callbacks.ensureTaskNotCancelled(task);
  const action =
    mode === 'approval_resume' ? 'Resuming approved goal' : mode === 'retry' ? 'Retrying goal' : 'Received goal';
  callbacks.syncTaskRuntime(task, {
    currentStep: 'goal_intake',
    retryCount: state.retryCount,
    maxRetries: state.maxRetries
  });
  task.mainChainNode = 'entry_router';
  task.currentNode = 'receive_decree';
  markExecutionStepCompleted(task, 'request-received', `${action}: ${dto.goal}`, 'session');
  callbacks.addTrace(task, 'entry_router', `${action}: ${dto.goal}`, {
    requestedMode: task.entryDecision?.requestedMode,
    workflowId: task.resolvedWorkflow?.id
  });
  await callbacks.persistAndEmitTask(task);
  return {
    currentStep: 'goal_intake',
    observations: [...state.observations, `goal:${dto.goal}`]
  };
}

export async function runRouteStage<TTask extends SupervisorPlanningTaskLike>(
  task: TTask,
  state: RuntimeAgentGraphState,
  callbacks: PlanningCallbacks<TTask>
): Promise<Partial<RuntimeAgentGraphState>> {
  callbacks.ensureTaskNotCancelled(task);
  callbacks.syncTaskRuntime(task, {
    currentStep: 'route',
    retryCount: state.retryCount,
    maxRetries: state.maxRetries
  });
  task.mainChainNode = 'mode_gate';
  task.currentNode = 'mode_gate';
  const modelRoute = callbacks.resolveWorkflowRoutes(task, task.resolvedWorkflow);
  task.modelRoute = modelRoute;
  task.currentMinistry = 'libu-governance';
  task.currentWorker = modelRoute?.find(item => item.ministry === 'libu-governance')?.workerId;
  callbacks.markWorkerUsage(task, task.currentWorker);
  markExecutionStepCompleted(task, 'route-selection', '吏部已完成模式裁剪、路由与选模。', 'libu');
  task.modeGateState = {
    requestedMode: task.executionPlan?.mode,
    activeMode: task.executionMode === 'imperial_direct' ? 'imperial_direct' : (task.executionPlan?.mode ?? 'execute'),
    reason:
      task.executionPlan?.mode === 'plan'
        ? '模式门已切到 plan，只开放只读/规划能力。'
        : task.executionPlan?.mode === 'imperial_direct'
          ? '模式门已登记特旨直达。'
          : '模式门已切到 execute，允许按角色装载全量执行能力。',
    updatedAt: new Date().toISOString()
  };
  task.guardrailState = {
    stage: 'pre',
    verdict: 'pass_through',
    summary:
      task.executionPlan?.mode === 'plan'
        ? '前置护栏已确认当前轮只允许规划、研究与轻量只读。'
        : '前置护栏已确认当前轮可进入执行链，但仍保留审批与终审底线。',
    updatedAt: new Date().toISOString()
  };
  callbacks.addTrace(task, 'mode_gate', '模式门已完成模式裁剪、路由与选模。', {
    modelRoute,
    activeMode: task.modeGateState.activeMode
  });
  if (task.specialistLead) {
    callbacks.addTrace(task, 'specialist_routed', `本轮主导专家：${task.specialistLead.displayName}`, {
      specialistLead: task.specialistLead,
      supportingSpecialists: task.supportingSpecialists,
      routeConfidence: task.routeConfidence
    });
    callbacks.addProgressDelta(
      task,
      task.supportingSpecialists && task.supportingSpecialists.length > 0
        ? `当前由${task.specialistLead.displayName}主导，并发征询 ${task.supportingSpecialists
            .map(item => item.displayName)
            .join('、')} 的专项意见。`
        : `当前由${task.specialistLead.displayName}主导回答。`
    );
  }
  if (state.resumeFromApproval) {
    callbacks.addTrace(task, 'route', 'Resuming graph from approved execution state');
    await callbacks.persistAndEmitTask(task);
  }
  return { currentStep: 'route' };
}
