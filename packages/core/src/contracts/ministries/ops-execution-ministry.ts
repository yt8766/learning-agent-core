import type { AgentExecutionState } from '../../tasking/types/orchestration';
import type { CodeExecutionResult } from './code-execution-ministry';

export interface OpsExecutionMinistryLike {
  execute(subTask: string, researchSummary: string): Promise<CodeExecutionResult>;
  getState(): AgentExecutionState;
}
