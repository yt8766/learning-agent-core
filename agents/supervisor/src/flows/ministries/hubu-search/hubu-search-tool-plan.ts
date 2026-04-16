import { withReactiveContextRetry } from '@agent/adapters';
import { safeGenerateObject } from '@agent/adapters';
import { generateObjectWithRetry } from '../../../utils/llm-retry';
import type { AgentRuntimeContext } from '../../../runtime/agent-runtime-context';
import { buildHeuristicResearchPlan, type ResearchToolId, ResearchToolPlanSchema } from './hubu-search-helpers';
import { z } from 'zod/v4';

export async function resolveHubuResearchToolPlan(params: {
  context: AgentRuntimeContext;
  subTask: string;
  availableTools: ResearchToolId[];
}) {
  const heuristicPlan = buildHeuristicResearchPlan(params.context.goal, params.availableTools);

  if (!params.context.llm.isConfigured()) {
    return heuristicPlan;
  }

  const llmPlan = await safeGenerateObject<z.infer<typeof ResearchToolPlanSchema>>({
    contractName: 'research-tool-plan',
    contractVersion: 'research-tool-plan.v1',
    isConfigured: params.context.llm.isConfigured(),
    schema: ResearchToolPlanSchema,
    invoke: async () =>
      withReactiveContextRetry({
        context: params.context,
        trigger: 'hubu-tool-plan',
        messages: [
          {
            role: 'system',
            content: '你是户部研究调度器。只从给定工具名单中选择最合适的研究工具顺序，优先受控来源。'
          },
          {
            role: 'user',
            content: JSON.stringify({
              goal: params.context.goal,
              subTask: params.subTask,
              availableTools: params.availableTools
            })
          }
        ],
        invoke: async retryMessages =>
          generateObjectWithRetry({
            llm: params.context.llm,
            contractName: 'research-tool-plan',
            contractVersion: 'research-tool-plan.v1',
            messages: retryMessages,
            schema: ResearchToolPlanSchema,
            options: {
              role: 'research',
              taskId: params.context.taskId,
              modelId: params.context.currentWorker?.defaultModel,
              budgetState: params.context.budgetState,
              thinking: params.context.thinking.research,
              temperature: 0.1,
              onUsage: usage => {
                params.context.onUsage?.({
                  usage,
                  role: 'research'
                });
              }
            }
          })
      })
  });

  const llmTools = llmPlan.object
    ? [llmPlan.object.primaryTool, ...llmPlan.object.followupTools].filter(
        (tool, index, list): tool is ResearchToolId =>
          params.availableTools.includes(tool) && list.indexOf(tool) === index
      )
    : [];

  return llmTools.length > 0 ? llmTools : heuristicPlan;
}
