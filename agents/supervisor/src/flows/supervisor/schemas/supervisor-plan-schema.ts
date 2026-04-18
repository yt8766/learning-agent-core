import { z } from 'zod/v4';

import { AgentRole } from '../supervisor-architecture-helpers';

export const SupervisorPlanSubTaskSchema = z.object({
  title: z.string().describe('子任务标题'),
  description: z.string().describe('子任务说明'),
  assignedTo: z.enum([AgentRole.RESEARCH, AgentRole.EXECUTOR, AgentRole.REVIEWER]).describe('子任务分派给的执行角色')
});

export const SupervisorPlanSchema = z.object({
  summary: z.string().describe('首辅对本轮任务的中文摘要'),
  steps: z.array(z.string()).min(3).max(6).describe('首辅规划出的阶段步骤'),
  subTasks: z.array(SupervisorPlanSubTaskSchema).min(3).max(3).describe('研究、执行、评审三个子任务')
});

export type SupervisorPlanOutput = z.infer<typeof SupervisorPlanSchema>;
