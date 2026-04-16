import type { AgentExecutionState } from '../types';
import type { CodeExecutionResult } from './code-execution-ministry';

export interface OpsExecutionMinistryLike {
  execute(subTask: string, researchSummary: string): Promise<CodeExecutionResult>;
  getState(): AgentExecutionState;
}
