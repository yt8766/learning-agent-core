import type { AgentExecutionState } from '../types';

export interface ApprovedExecutionAgentLike {
  getState(): AgentExecutionState;
}
