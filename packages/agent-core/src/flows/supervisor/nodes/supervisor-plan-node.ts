import type { AgentRuntimeContext } from '../../../runtime/agent-runtime-context';
import { SUPERVISOR_PLAN_SYSTEM_PROMPT, buildSupervisorPlanUserPrompt } from '../prompts/supervisor-plan-prompts';
import { buildFallbackSupervisorPlan, toManagerPlan } from '../contracts/supervisor-plan-contract';
import { SupervisorPlanSchema } from '../schemas/supervisor-plan-schema';

export async function executeSupervisorPlan(context: AgentRuntimeContext) {
  const result = await context.llm.generateObject(
    [
      {
        role: 'system',
        content: SUPERVISOR_PLAN_SYSTEM_PROMPT
      },
      {
        role: 'user',
        content: context.taskContext
          ? [buildSupervisorPlanUserPrompt(context.goal), '以下是当前任务上下文：', context.taskContext].join('\n\n')
          : buildSupervisorPlanUserPrompt(context.goal)
      }
    ],
    SupervisorPlanSchema,
    {
      role: 'manager',
      taskId: context.taskId,
      modelId: context.currentWorker?.defaultModel,
      budgetState: context.budgetState,
      thinking: context.thinking.manager,
      temperature: 0.1,
      onUsage: usage => {
        context.onUsage?.({
          usage,
          role: 'manager'
        });
      }
    }
  );

  return toManagerPlan(
    { taskId: context.taskId, goal: context.goal },
    result ?? buildFallbackSupervisorPlan({ taskId: context.taskId, goal: context.goal })
  );
}
