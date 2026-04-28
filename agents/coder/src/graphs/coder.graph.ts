import { Annotation, END, START, StateGraph } from '@langchain/langgraph';

import type { ToolExecutionResult } from '@agent/runtime';

export interface CoderGraphState {
  goal: string;
  context?: string;
  researchSummary?: string;
  executionResult?: ToolExecutionResult;
  summary?: string;
}

export interface CoderGraphHandlers {
  execute?: (state: CoderGraphState) => Promise<CoderGraphState>;
}

const CoderAnnotation = Annotation.Root({
  goal: Annotation<string>(),
  context: Annotation<string | undefined>(),
  researchSummary: Annotation<string | undefined>(),
  executionResult: Annotation<ToolExecutionResult | undefined>(),
  summary: Annotation<string | undefined>()
});

export function createCoderGraph(handlers: CoderGraphHandlers = {}) {
  return new StateGraph(CoderAnnotation)
    .addNode('execute', state => (handlers.execute ? handlers.execute(state) : Promise.resolve(state)))
    .addEdge(START, 'execute')
    .addEdge('execute', END);
}
