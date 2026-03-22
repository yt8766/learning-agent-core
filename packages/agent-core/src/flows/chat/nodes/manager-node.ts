import { z } from 'zod/v4';

import { AgentRole, ManagerPlan, ReviewRecord } from '@agent/shared';

import { AgentRuntimeContext } from '../../../runtime/agent-runtime-context';
import { BaseAgent } from '../base-agent';

export class ManagerAgent extends BaseAgent {
  constructor(context: AgentRuntimeContext) {
    super(AgentRole.MANAGER, context);
  }

  async plan(): Promise<ManagerPlan> {
    this.setStatus('running');

    const planSchema = z.object({
      summary: z.string(),
      steps: z.array(z.string()).min(3).max(6),
      subTasks: z
        .array(
          z.object({
            title: z.string(),
            description: z.string(),
            assignedTo: z.enum([AgentRole.RESEARCH, AgentRole.EXECUTOR, AgentRole.REVIEWER])
          })
        )
        .min(3)
        .max(3)
    });

    const llmPlan = await this.generateObject(
      [
        {
          role: 'system',
          content:
            '你是多 Agent 系统中的主 Agent。请始终使用中文输出，并把目标拆解为研究、执行、评审三个子任务。若用户在定义人设、聊天风格或“你是……”这类对话能力，也要把“技能检索或技能补足”纳入规划。'
        },
        {
          role: 'user',
          content: `目标：${this.context.goal}`
        }
      ],
      planSchema,
      {
        role: 'manager',
        thinking: this.context.thinking.manager
      }
    );

    const fallbackSubTasks = [
      {
        title: '研究上下文',
        description: `检索与目标相关的历史记忆、规则和技能：${this.context.goal}`,
        assignedTo: AgentRole.RESEARCH
      },
      {
        title: '执行任务',
        description: `围绕目标执行最合适的方案：${this.context.goal}`,
        assignedTo: AgentRole.EXECUTOR
      },
      {
        title: '评审结果',
        description: `评审执行质量并决定是否沉淀经验：${this.context.goal}`,
        assignedTo: AgentRole.REVIEWER
      }
    ];

    const subTasks = (llmPlan?.subTasks ?? fallbackSubTasks).map((subTask, index) => ({
      id: `sub_${this.context.taskId}_${index + 1}`,
      title: subTask.title,
      description: subTask.description,
      assignedTo: subTask.assignedTo,
      status: 'pending' as const
    }));

    const plan: ManagerPlan = {
      id: `plan_${this.context.taskId}`,
      goal: this.context.goal,
      summary: llmPlan?.summary ?? '主 Agent 已将任务拆分为研究、执行、评审三个阶段。',
      steps: llmPlan?.steps ?? ['研究相关上下文', '执行最合适的动作', '评审结果并沉淀经验'],
      subTasks,
      createdAt: new Date().toISOString()
    };

    this.state.plan = plan.steps;
    this.state.finalOutput = plan.summary;
    this.remember(plan.summary);
    this.setStatus('completed');
    return plan;
  }

  dispatch(plan: ManagerPlan) {
    return plan.subTasks.map(subTask => ({
      taskId: this.context.taskId,
      subTaskId: subTask.id,
      from: AgentRole.MANAGER,
      to: subTask.assignedTo,
      objective: subTask.description
    }));
  }

  async replyDirectly(): Promise<string> {
    this.setStatus('running');
    this.setSubTask('直接回答用户问题');
    const messageId = `direct_reply_${this.context.taskId}`;
    const promptMessages = [
      {
        role: 'system' as const,
        content:
          '你是多 Agent 系统中的主 Agent。请始终使用中文，直接回答用户问题。像“你是谁”“你能做什么”“请介绍你自己”这类问题，不要展示内部规划过程，不要提及研究节点、执行节点或评审节点，只输出面向用户的最终答案。'
      },
      {
        role: 'user' as const,
        content: this.context.goal
      }
    ];

    const streamed = await this.streamText(promptMessages, {
      role: 'manager',
      thinking: this.context.thinking.manager,
      messageId
    });
    const fallback =
      streamed ??
      (await this.generateText(promptMessages, {
        role: 'manager',
        thinking: this.context.thinking.manager
      }));

    this.state.finalOutput =
      fallback ?? '我是一个多 Agent 协作助手，负责理解你的目标、调度研究与执行能力，并用中文直接给你结果。';
    this.setStatus('completed');
    return this.state.finalOutput;
  }

  async finalize(review: ReviewRecord, executionSummary: string): Promise<string> {
    const messageId = `summary_stream_${this.context.taskId}`;
    const promptMessages = [
      {
        role: 'system' as const,
        content: '你是主 Agent。请始终使用中文，把执行结果和评审结论整合成简洁、自然、可直接展示给用户的最终回复。'
      },
      {
        role: 'user' as const,
        content: `目标：${this.context.goal}\n执行摘要：${executionSummary}\n评审结论：${review.decision}\n评审说明：${review.notes.join('；')}`
      }
    ];

    const llmSummary = await this.streamText(promptMessages, {
      role: 'manager',
      thinking: this.context.thinking.manager,
      messageId
    });

    const fallbackSummary =
      llmSummary ??
      (await this.generateText(promptMessages, {
        role: 'manager',
        thinking: this.context.thinking.manager
      }));

    this.state.evaluation = {
      success: review.decision === 'approved',
      quality: review.decision === 'approved' ? 'high' : review.decision === 'retry' ? 'medium' : 'low',
      shouldRetry: review.decision === 'retry',
      shouldWriteMemory: review.decision !== 'blocked',
      shouldCreateRule: review.decision === 'blocked',
      shouldExtractSkill: review.decision === 'approved',
      notes: review.notes
    };
    this.state.finalOutput = fallbackSummary ?? executionSummary;
    return this.state.finalOutput;
  }
}
