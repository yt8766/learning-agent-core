import { Annotation, END, START, StateGraph } from '@langchain/langgraph';

import type { LearningCandidateRecord } from '@agent/memory';
import { runLearningConfirmNode, runLearningFinishNode } from '../../flows/learning/graph/learning-graph-nodes';

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
    .addNode('confirm', state => runLearningConfirmNode(state, handlers))
    .addNode('finish', state => runLearningFinishNode(state, handlers))
    .addEdge(START, 'confirm')
    .addEdge('confirm', 'finish')
    .addEdge('finish', END);
}
