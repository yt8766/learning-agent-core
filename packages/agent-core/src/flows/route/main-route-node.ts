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

  const routeState: {
    executionSteps: NonNullable<MainRouteGraphState['executionSteps']>;
    currentExecutionStep?: MainRouteGraphState['currentExecutionStep'];
    chatRoute: NonNullable<{
      graph: typeof route.graph;
      flow: typeof route.flow;
      reason: typeof route.reason;
      adapter: typeof route.adapter;
      priority: typeof route.priority;
      intent: typeof route.intent;
      intentConfidence: typeof route.intentConfidence;
      executionReadiness: typeof route.executionReadiness;
      matchedSignals: typeof route.matchedSignals;
      readinessReason: typeof route.readinessReason;
      profileAdjustmentReason: typeof route.profileAdjustmentReason;
      preferredExecutionMode: typeof route.preferredExecutionMode;
    }>;
  } = {
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
    }
  };
  markExecutionStepCompleted(
    routeState as any,
    'request-received',
    state.goal ? `收到目标：${state.goal}` : '收到用户请求'
  );
  markExecutionStepCompleted(routeState as any, 'route-selection', route.reason);

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
