import type { AgentRuntimeContext } from '../../runtime/agent-runtime-context';
import type { ApprovedExecutionAgentLike, PendingExecutionContext } from '@agent/core';
import type { ToolExecutionResult } from '@agent/runtime';

export async function executeApprovedAction(
  context: Pick<AgentRuntimeContext, 'taskId' | 'goal' | 'sandbox'>,
  pending: PendingExecutionContext
): Promise<ToolExecutionResult> {
  return context.sandbox.execute({
    taskId: context.taskId,
    toolName: pending.toolName,
    intent: pending.intent,
    input: {
      ...(pending.toolInput ?? {}),
      goal: pending.goal ?? context.goal,
      researchSummary: pending.researchSummary,
      approved: true
    },
    requestedBy: 'agent'
  });
}

export function syncApprovedExecutorState(
  executor: ApprovedExecutionAgentLike,
  executionResult: ToolExecutionResult,
  pending: PendingExecutionContext
) {
  const executorState = executor.getState();
  executorState.status = 'completed';
  executorState.subTask = 'Execute the approved action';
  executorState.plan = ['Receive human approval', 'Execute approved high-risk action'];
  executorState.toolCalls = [`intent:${pending.intent}`, `tool:${pending.toolName}`];
  executorState.observations = [executionResult.outputSummary];
  executorState.shortTermMemory = [pending.researchSummary, executionResult.outputSummary];
  executorState.finalOutput = executionResult.outputSummary;
  return executorState;
}
