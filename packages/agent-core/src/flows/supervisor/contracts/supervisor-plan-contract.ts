import type { ManagerPlan } from '@agent/shared';
import { AgentRole } from '@agent/shared';

import type { SupervisorPlanOutput } from '../schemas/supervisor-plan-schema';

export interface SupervisorPlanContext {
  taskId: string;
  goal: string;
}

export function buildFallbackSupervisorPlan(context: SupervisorPlanContext): SupervisorPlanOutput {
  return {
    summary: '首辅已将任务拆分为研究、执行、评审三个阶段。',
    steps: ['研究相关上下文', '执行最合适的动作', '评审结果并沉淀经验'],
    subTasks: [
      {
        title: '研究上下文',
        description: `检索与目标相关的历史记忆、规则和技能：${context.goal}`,
        assignedTo: AgentRole.RESEARCH
      },
      {
        title: '执行任务',
        description: `围绕目标执行最合适的方案：${context.goal}`,
        assignedTo: AgentRole.EXECUTOR
      },
      {
        title: '评审结果',
        description: `评审执行质量并决定是否沉淀经验：${context.goal}`,
        assignedTo: AgentRole.REVIEWER
      }
    ]
  };
}

export function toManagerPlan(context: SupervisorPlanContext, output: SupervisorPlanOutput): ManagerPlan {
  return {
    id: `plan_${context.taskId}`,
    goal: context.goal,
    summary: output.summary,
    steps: output.steps,
    subTasks: output.subTasks.map((subTask, index) => ({
      id: `sub_${context.taskId}_${index + 1}`,
      title: subTask.title,
      description: subTask.description,
      assignedTo: subTask.assignedTo,
      status: 'pending'
    })),
    createdAt: new Date().toISOString()
  };
}
