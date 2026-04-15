import type { ManagerPlan } from '@agent/shared';
import { AgentRole } from '@agent/shared';

import type { SupervisorPlanOutput } from '../schemas/supervisor-plan-schema';

export interface SupervisorPlanContext {
  taskId: string;
  goal: string;
}

export function inferDispatchKind(subTask: {
  title: string;
  description: string;
  assignedTo: AgentRole;
}): 'strategy' | 'ministry' | 'fallback' {
  const normalized = `${subTask.title} ${subTask.description}`.toLowerCase();
  if (subTask.assignedTo === AgentRole.MANAGER || /兜底|保底|直接回答|整理答复|通用助理/.test(normalized)) {
    return 'fallback';
  }
  if (/策略|约束|路线|风险|架构|投放|支付|产品|合规|票拟/.test(normalized)) {
    return 'strategy';
  }
  return 'ministry';
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
