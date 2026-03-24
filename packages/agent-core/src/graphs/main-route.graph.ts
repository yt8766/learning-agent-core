import { Annotation, END, START, StateGraph } from '@langchain/langgraph';

import type { WorkflowPresetDefinition } from '@agent/shared';

import { resolveWorkflowRoute } from '../workflows/workflow-route-registry';

export interface MainRouteGraphState {
  goal: string;
  workflow?: WorkflowPresetDefinition;
  selectedGraph?: 'workflow' | 'approval-recovery' | 'learning';
  selectedFlow?: 'supervisor' | 'approval' | 'learning' | 'direct-reply';
  routeReason?: string;
}

export interface MainRouteGraphHandlers {
  route?: (state: MainRouteGraphState) => Promise<MainRouteGraphState>;
}

const MainRouteAnnotation = Annotation.Root({
  goal: Annotation<string>(),
  workflow: Annotation<WorkflowPresetDefinition | undefined>(),
  selectedGraph: Annotation<'workflow' | 'approval-recovery' | 'learning' | undefined>(),
  selectedFlow: Annotation<'supervisor' | 'approval' | 'learning' | 'direct-reply' | undefined>(),
  routeReason: Annotation<string | undefined>()
});

export function createMainRouteGraph(handlers: MainRouteGraphHandlers = {}) {
  return new StateGraph(MainRouteAnnotation)
    .addNode('route', async state => {
      if (handlers.route) {
        return handlers.route(state);
      }

      const route = resolveWorkflowRoute({
        goal: state.goal,
        workflow: state.workflow
      });

      return {
        ...state,
        selectedGraph: route.graph,
        selectedFlow: route.flow,
        routeReason: route.reason
      };
    })
    .addEdge(START, 'route')
    .addEdge('route', END);
}
