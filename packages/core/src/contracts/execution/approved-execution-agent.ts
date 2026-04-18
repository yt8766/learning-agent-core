import type { AgentExecutionState } from '../../tasking/types/orchestration';

export interface ApprovedExecutionAgentLike {
  getState(): AgentExecutionState;
}
