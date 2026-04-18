import type { LearningGraphHandlers, LearningGraphState } from '../../../graphs/learning/learning.graph';

export async function runLearningConfirmNode(
  state: LearningGraphState,
  handlers: LearningGraphHandlers = {}
): Promise<LearningGraphState> {
  return handlers.confirm ? handlers.confirm(state) : state;
}

export async function runLearningFinishNode(
  state: LearningGraphState,
  handlers: LearningGraphHandlers = {}
): Promise<LearningGraphState> {
  return handlers.finish ? handlers.finish(state) : state;
}
