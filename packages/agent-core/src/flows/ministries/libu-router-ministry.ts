import { z } from 'zod/v4';

import { AgentExecutionState, AgentRole, ManagerPlan, ReviewRecord } from '@agent/shared';

import { AgentRuntimeContext } from '../../runtime/agent-runtime-context';

export class LibuRouterMinistry {
  private readonly state: AgentExecutionState;

  constructor(private readonly context: AgentRuntimeContext) {
    this.state = {
      agentId: `libu_router_${context.taskId}`,
      role: AgentRole.MANAGER,
      goal: context.goal,
      plan: [],
      toolCalls: [],
      observations: [],
      shortTermMemory: [],
      longTermMemoryRefs: [],
      status: 'idle'
    };
  }

  async plan(): Promise<ManagerPlan> {
    this.state.status = 'running';

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

    let llmPlan: z.infer<typeof planSchema> | null = null;
    if (this.context.llm.isConfigured()) {
      try {
        llmPlan = await this.context.llm.generateObject(
          [
            {
              role: 'system',
              content:
                '你是内阁首辅。请始终使用中文输出，并把目标拆解为研究、执行、评审三个子任务。若用户在定义人设、聊天风格或“你是……”这类对话能力，也要把“技能检索或技能补足”纳入规划。'
            },
            {
              role: 'user',
              content: `目标：${this.context.goal}`
            }
          ],
          planSchema,
          {
            role: 'manager',
            thinking: this.context.thinking.manager,
            temperature: 0.1,
            onUsage: usage => {
              this.context.onUsage?.({
                usage,
                role: 'manager'
              });
            }
          }
        );
      } catch {
        llmPlan = null;
      }
    }

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
      summary: llmPlan?.summary ?? '首辅已将任务拆分为研究、执行、评审三个阶段。',
      steps: llmPlan?.steps ?? ['研究相关上下文', '执行最合适的动作', '评审结果并沉淀经验'],
      subTasks,
      createdAt: new Date().toISOString()
    };

    this.state.plan = plan.steps;
    this.state.observations = [plan.summary];
    this.state.shortTermMemory = [plan.summary];
    this.state.finalOutput = plan.summary;
    this.state.status = 'completed';
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
    this.state.status = 'running';
    this.state.subTask = '直接回答用户问题';
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

    let streamed: string | null = null;
    if (this.context.llm.isConfigured()) {
      try {
        streamed = await this.context.llm.streamText(
          promptMessages,
          {
            role: 'manager',
            thinking: this.context.thinking.manager,
            temperature: 0.2,
            onUsage: usage => {
              this.context.onUsage?.({
                usage,
                role: 'manager'
              });
            }
          },
          (token, metadata) => {
            this.context.onToken?.({
              token,
              role: 'manager',
              messageId,
              model: metadata?.model
            });
          }
        );
      } catch {
        streamed = null;
      }
    }

    let fallback: string | null = null;
    if (!streamed && this.context.llm.isConfigured()) {
      try {
        fallback = await this.context.llm.generateText(promptMessages, {
          role: 'manager',
          thinking: this.context.thinking.manager,
          temperature: 0.2,
          onUsage: usage => {
            this.context.onUsage?.({
              usage,
              role: 'manager'
            });
          }
        });
      } catch {
        fallback = null;
      }
    }

    this.state.finalOutput =
      streamed ?? fallback ?? '我是一个多 Agent 协作助手，负责理解你的目标、调度研究与执行能力，并用中文直接给你结果。';
    this.state.status = 'completed';
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

    let llmSummary: string | null = null;
    if (this.context.llm.isConfigured()) {
      try {
        llmSummary = await this.context.llm.streamText(
          promptMessages,
          {
            role: 'manager',
            thinking: this.context.thinking.manager,
            temperature: 0.2,
            onUsage: usage => {
              this.context.onUsage?.({
                usage,
                role: 'manager'
              });
            }
          },
          (token, metadata) => {
            this.context.onToken?.({
              token,
              role: 'manager',
              messageId,
              model: metadata?.model
            });
          }
        );
      } catch {
        llmSummary = null;
      }
    }

    let fallbackSummary: string | null = null;
    if (!llmSummary && this.context.llm.isConfigured()) {
      try {
        fallbackSummary = await this.context.llm.generateText(promptMessages, {
          role: 'manager',
          thinking: this.context.thinking.manager,
          temperature: 0.2,
          onUsage: usage => {
            this.context.onUsage?.({
              usage,
              role: 'manager'
            });
          }
        });
      } catch {
        fallbackSummary = null;
      }
    }

    this.state.evaluation = {
      success: review.decision === 'approved',
      quality: review.decision === 'approved' ? 'high' : review.decision === 'retry' ? 'medium' : 'low',
      shouldRetry: review.decision === 'retry',
      shouldWriteMemory: review.decision !== 'blocked',
      shouldCreateRule: review.decision === 'blocked',
      shouldExtractSkill: review.decision === 'approved',
      notes: review.notes
    };
    this.state.finalOutput = llmSummary ?? fallbackSummary ?? executionSummary;
    this.state.status = 'completed';
    return this.state.finalOutput;
  }

  getState(): AgentExecutionState {
    return this.state;
  }
}
