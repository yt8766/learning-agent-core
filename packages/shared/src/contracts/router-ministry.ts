import type { AgentExecutionState, DispatchInstruction, ManagerPlan, ReviewRecord } from '../types';

export interface RouterMinistryLike {
  plan(): Promise<ManagerPlan>;
  dispatch(plan: ManagerPlan): DispatchInstruction[];
  replyDirectly(): Promise<string>;
  finalize(
    review: ReviewRecord,
    executionSummary: string,
    freshnessSourceSummary?: string,
    citationSourceSummary?: string
  ): Promise<string>;
  getState(): AgentExecutionState;
}
