import { ActionIntent } from '@agent/core';

import type { AgentRuntimeContext } from '../../../runtime/agent-runtime-context';
import { withReactiveContextRetry } from '../../../utils/reactive-context-retry';
import { generateObjectWithRetry } from '../../../utils/llm-retry';
import { GONGBU_EXECUTION_SYSTEM_PROMPT } from './prompts/execution-prompts';
import { ExecutionActionSchema } from './schemas/execution-action-schema';

type ActionIntentValue = (typeof ActionIntent)[keyof typeof ActionIntent];

export type GongbuExecutionSelection = {
  intent: ActionIntentValue;
  toolName: string;
  rationale: string;
  actionPrompt: string;
};

export async function selectGongbuExecution(params: {
  context: AgentRuntimeContext;
  researchSummary: string;
  availableTools: Array<{
    name: string;
    description: string;
    riskLevel: string;
    requiresApproval: boolean;
  }>;
}): Promise<GongbuExecutionSelection | null> {
  const { context, researchSummary, availableTools } = params;
  if (!context.llm.isConfigured()) {
    return null;
  }

  try {
    return await withReactiveContextRetry({
      context,
      trigger: 'gongbu-selection',
      messages: [
        {
          role: 'system',
          content: GONGBU_EXECUTION_SYSTEM_PROMPT
        },
        {
          role: 'user',
          content: JSON.stringify({
            goal: context.goal,
            taskContext: context.taskContext,
            researchSummary,
            availableTools
          })
        }
      ],
      invoke: async messages =>
        generateObjectWithRetry({
          llm: context.llm,
          contractName: 'gongbu-execution-selection',
          contractVersion: 'gongbu-execution-selection.v1',
          messages,
          schema: ExecutionActionSchema,
          options: {
            role: 'executor',
            modelId: context.currentWorker?.defaultModel,
            taskId: context.taskId,
            thinking: context.thinking.executor,
            temperature: 0.1,
            budgetState: context.budgetState,
            onUsage: usage => {
              context.onUsage?.({
                usage,
                role: 'executor'
              });
            }
          }
        })
    });
  } catch {
    return null;
  }
}
