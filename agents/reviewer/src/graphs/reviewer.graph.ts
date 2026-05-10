import { Annotation, END, START, StateGraph } from '@langchain/langgraph';

import type { EvaluationResult, ReviewRecord } from '@agent/core';
import type { ToolExecutionResult } from '@agent/runtime';

export interface ReviewerGraphState {
  executionResult?: ToolExecutionResult;
  executionSummary: string;
  review?: ReviewRecord;
  evaluation?: EvaluationResult;
}

export interface ReviewerGraphHandlers {
  review?: (state: ReviewerGraphState) => Promise<ReviewerGraphState>;
}

const ReviewerAnnotation = Annotation.Root({
  executionResult: Annotation<ToolExecutionResult | undefined>(),
  executionSummary: Annotation<string>(),
  review: Annotation<ReviewRecord | undefined>(),
  evaluation: Annotation<EvaluationResult | undefined>()
});

export function createReviewerGraph(handlers: ReviewerGraphHandlers = {}) {
  return new StateGraph(ReviewerAnnotation)
    .addNode('review', state => (handlers.review ? handlers.review(state) : Promise.resolve(state)))
    .addEdge(START, 'review')
    .addEdge('review', END);
}
