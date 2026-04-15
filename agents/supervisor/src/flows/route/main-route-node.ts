import type { ChatRouteRecord, TaskRecord } from '@agent/shared';
import { TaskStatus } from '@agent/shared';
import type { MainRouteGraphHandlers, MainRouteGraphState } from '../../graphs/main-route.graph';
import { markExecutionStepCompleted } from '../../workflows/execution-steps';
import { resolveWorkflowRoute } from '../../workflows/workflow-route-registry';

export async function runMainRouteNode(
  state: MainRouteGraphState,
  handlers: MainRouteGraphHandlers = {}
): Promise<MainRouteGraphState> {
  if (handlers.route) {
    return handlers.route(state);
  }

  const route = resolveWorkflowRoute({
    goal: state.goal,
    context: state.context,
    workflow: state.workflow,
    requestedHints: state.requestedHints
  });

  const timestamp = new Date().toISOString();
  const routeState: TaskRecord = {
    id: 'main-route-preview',
    goal: state.goal,
    status: TaskStatus.QUEUED,
    trace: [],
    approvals: [],
    agentStates: [],
    messages: [],
    createdAt: timestamp,
    updatedAt: timestamp,
    executionSteps: state.executionSteps ? [...state.executionSteps] : [],
    chatRoute: {
      graph: route.graph,
      flow: route.flow,
      reason: route.reason,
      adapter: route.adapter,
      priority: route.priority,
      intent: route.intent,
      intentConfidence: route.intentConfidence,
      executionReadiness: route.executionReadiness,
      matchedSignals: route.matchedSignals,
      readinessReason: route.readinessReason,
      profileAdjustmentReason: route.profileAdjustmentReason,
      preferredExecutionMode: route.preferredExecutionMode
    } satisfies ChatRouteRecord
  };
  markExecutionStepCompleted(routeState, 'request-received', state.goal ? `收到目标：${state.goal}` : '收到用户请求');
  markExecutionStepCompleted(routeState, 'route-selection', route.reason);

  return {
    ...state,
    executionSteps: routeState.executionSteps,
    currentExecutionStep: routeState.currentExecutionStep,
    selectedIntent: route.intent,
    intentConfidence: route.intentConfidence,
    executionReadiness: route.executionReadiness,
    routeSignals: route.matchedSignals,
    selectedGraph: route.graph,
    selectedFlow: route.flow,
    routeReason: route.reason
  };
}
