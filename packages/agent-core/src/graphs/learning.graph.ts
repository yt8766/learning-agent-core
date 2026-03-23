import { Annotation, END, START, StateGraph } from '@langchain/langgraph';

import { LearningCandidateRecord } from '@agent/shared';

export interface LearningGraphState {
  taskId: string;
  candidateIds: string[];
  autoConfirmed: boolean;
  confirmedCandidates: LearningCandidateRecord[];
}

export interface LearningGraphHandlers {
  confirm?: (state: LearningGraphState) => Promise<LearningGraphState>;
  finish?: (state: LearningGraphState) => Promise<LearningGraphState>;
}

const LearningAnnotation = Annotation.Root({
  taskId: Annotation<string>(),
  candidateIds: Annotation<string[]>(),
  autoConfirmed: Annotation<boolean>(),
  confirmedCandidates: Annotation<LearningCandidateRecord[]>()
});

export function createLearningGraph(handlers: LearningGraphHandlers = {}) {
  return new StateGraph(LearningAnnotation)
    .addNode('confirm', async state => (handlers.confirm ? handlers.confirm(state) : state))
    .addNode('finish', async state => (handlers.finish ? handlers.finish(state) : state))
    .addEdge(START, 'confirm')
    .addEdge('confirm', 'finish')
    .addEdge('finish', END);
}
