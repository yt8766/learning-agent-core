import type { AgentRuntimeContext } from '../../../runtime/agent-runtime-context';
import { sanitizeTaskContextForModel } from '../../../utils/prompts/runtime-output-sanitizer';
import { generateObjectWithRetry } from '../../../utils/llm-retry';
import { SUPERVISOR_PLAN_SYSTEM_PROMPT, buildSupervisorPlanUserPrompt } from '../prompts/supervisor-plan-prompts';
import { buildFallbackSupervisorPlan, toManagerPlan } from '../contracts/supervisor-plan-contract';
import { SupervisorPlanSchema } from '../schemas/supervisor-plan-schema';

export async function executeSupervisorPlan(context: AgentRuntimeContext) {
  const sanitizedTaskContext = sanitizeTaskContextForModel(context.taskContext);
  let result;
  try {
    result = await generateObjectWithRetry({
      llm: context.llm,
      contractName: 'supervisor-plan',
      contractVersion: '1.0.0',
      messages: [
        {
          role: 'system',
          content: SUPERVISOR_PLAN_SYSTEM_PROMPT
        },
        {
          role: 'user',
          content: sanitizedTaskContext
            ? [
                buildSupervisorPlanUserPrompt(context.goal, {
                  specialistLead: context.specialistLead,
                  supportingSpecialists: context.supportingSpecialists,
                  routeConfidence: context.routeConfidence
                }),
                '以下是当前任务上下文：',
                sanitizedTaskContext
              ].join('\n\n')
            : buildSupervisorPlanUserPrompt(context.goal, {
                specialistLead: context.specialistLead,
                supportingSpecialists: context.supportingSpecialists,
                routeConfidence: context.routeConfidence
              })
        }
      ],
      schema: SupervisorPlanSchema,
      options: {
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
    });
  } catch {
    result = null;
  }

  return toManagerPlan(
    {
      taskId: context.taskId,
      goal: context.goal,
      specialistLead: context.specialistLead,
      supportingSpecialists: context.supportingSpecialists
    },
    result ??
      buildFallbackSupervisorPlan({
        taskId: context.taskId,
        goal: context.goal,
        specialistLead: context.specialistLead,
        supportingSpecialists: context.supportingSpecialists
      })
  );
}
