import { Annotation, END, START, StateGraph } from '@langchain/langgraph';

import type { ExecutionStepRecord, RequestedExecutionHints, WorkflowPresetDefinition } from '@agent/shared';

import { runMainRouteNode } from '../flows/route/main-route-node';

export interface MainRouteGraphState {
  goal: string;
  context?: string;
  workflow?: WorkflowPresetDefinition;
  requestedHints?: RequestedExecutionHints;
  executionSteps?: ExecutionStepRecord[];
  currentExecutionStep?: ExecutionStepRecord;
  selectedIntent?: 'direct-reply' | 'research-first' | 'plan-only' | 'workflow-execute' | 'approval-recovery';
  intentConfidence?: number;
  executionReadiness?:
    | 'ready'
    | 'approval-required'
    | 'missing-capability'
    | 'missing-connector'
    | 'missing-workspace'
    | 'blocked-by-policy';
  routeSignals?: string[];
  selectedGraph?: 'workflow' | 'approval-recovery' | 'learning';
  selectedFlow?: 'supervisor' | 'approval' | 'learning' | 'direct-reply';
  routeReason?: string;
}

export interface MainRouteGraphHandlers {
  route?: (state: MainRouteGraphState) => Promise<MainRouteGraphState>;
}

const MainRouteAnnotation = Annotation.Root({
  goal: Annotation<string>(),
  context: Annotation<string | undefined>(),
  workflow: Annotation<WorkflowPresetDefinition | undefined>(),
  requestedHints: Annotation<RequestedExecutionHints | undefined>(),
  executionSteps: Annotation<ExecutionStepRecord[] | undefined>(),
  currentExecutionStep: Annotation<ExecutionStepRecord | undefined>(),
  selectedIntent: Annotation<
    'direct-reply' | 'research-first' | 'plan-only' | 'workflow-execute' | 'approval-recovery' | undefined
  >(),
  intentConfidence: Annotation<number | undefined>(),
  executionReadiness: Annotation<
    | 'ready'
    | 'approval-required'
    | 'missing-capability'
    | 'missing-connector'
    | 'missing-workspace'
    | 'blocked-by-policy'
    | undefined
  >(),
  routeSignals: Annotation<string[] | undefined>(),
  selectedGraph: Annotation<'workflow' | 'approval-recovery' | 'learning' | undefined>(),
  selectedFlow: Annotation<'supervisor' | 'approval' | 'learning' | 'direct-reply' | undefined>(),
  routeReason: Annotation<string | undefined>()
});

export function createMainRouteGraph(handlers: MainRouteGraphHandlers = {}) {
  return new StateGraph(MainRouteAnnotation)
    .addNode('route', state => runMainRouteNode(state, handlers))
    .addEdge(START, 'route')
    .addEdge('route', END);
}
