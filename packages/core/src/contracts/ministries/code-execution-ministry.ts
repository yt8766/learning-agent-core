import type { ActionIntent } from '../../primitives/types/primitives.types';
import type { AgentExecutionState } from '../../tasking/types/orchestration';
import type { ToolDefinition, ToolExecutionResult } from '../../governance/types/governance.types';

export interface ApprovedExecutionContextLike {
  taskId: string;
  intent: ActionIntent;
  toolName: string;
  researchSummary: string;
  toolInput?: Record<string, unknown>;
}

export interface CodeExecutionResult {
  intent: ActionIntent;
  toolName: string;
  requiresApproval: boolean;
  tool?: ToolDefinition;
  executionResult?: ToolExecutionResult;
  summary: string;
  serverId?: string;
  capabilityId?: string;
  approvalReason?: string;
  approvalReasonCode?: string;
  approvalPreview?: Array<{
    label: string;
    value: string;
  }>;
  toolInput?: Record<string, unknown>;
}

export interface CodeExecutionMinistryLike {
  execute(subTask: string, researchSummary: string): Promise<CodeExecutionResult>;
  buildApprovedState(executionResult: ToolExecutionResult, pending: ApprovedExecutionContextLike): AgentExecutionState;
  getState(): AgentExecutionState;
}
