import type { ToolExecutionRequest, ToolExecutionResult } from '@agent/core';

export interface ToolFallbackExecutor {
  execute(request: ToolExecutionRequest): Promise<ToolExecutionResult>;
}

export interface ToolExecutionWatchdogObservation {
  taskId: string;
  toolName: string;
  serverId?: string;
  capabilityId?: string;
  timeoutMs?: number;
  request: ToolExecutionRequest;
  result?: ToolExecutionResult;
}

export interface ToolExecutionWatchdog {
  guard<T extends ToolExecutionResult>(
    observation: Omit<ToolExecutionWatchdogObservation, 'result'>,
    run: () => Promise<T>
  ): Promise<T | ToolExecutionResult>;
}
