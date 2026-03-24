import { AgentExecutionState, AgentRole, ManagerPlan, ReviewRecord } from '@agent/shared';

import { AgentRuntimeContext } from '../../runtime/agent-runtime-context';
import {
  buildFallbackSupervisorPlan,
  buildSupervisorPlanUserPrompt,
  SUPERVISOR_DIRECT_REPLY_PROMPT,
  SUPERVISOR_PLAN_SYSTEM_PROMPT,
  SupervisorPlanSchema,
  toManagerPlan
} from '../supervisor';
import { buildDeliverySummaryUserPrompt, DELIVERY_SUMMARY_SYSTEM_PROMPT } from '../delivery';

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

    let llmPlan: ManagerPlan | null = null;
    if (this.context.llm.isConfigured()) {
      try {
        const output = await this.context.llm.generateObject(
          [
            {
              role: 'system',
              content: SUPERVISOR_PLAN_SYSTEM_PROMPT
            },
            {
              role: 'user',
              content: buildSupervisorPlanUserPrompt(this.context.goal)
            }
          ],
          SupervisorPlanSchema,
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
        llmPlan = toManagerPlan(
          { taskId: this.context.taskId, goal: this.context.goal },
          output ?? buildFallbackSupervisorPlan({ taskId: this.context.taskId, goal: this.context.goal })
        );
      } catch {
        llmPlan = null;
      }
    }

    const plan =
      llmPlan ??
      toManagerPlan(
        { taskId: this.context.taskId, goal: this.context.goal },
        buildFallbackSupervisorPlan({ taskId: this.context.taskId, goal: this.context.goal })
      );

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
        content: SUPERVISOR_DIRECT_REPLY_PROMPT
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
        content: DELIVERY_SUMMARY_SYSTEM_PROMPT
      },
      {
        role: 'user' as const,
        content: buildDeliverySummaryUserPrompt(this.context.goal, executionSummary, review.decision, review.notes)
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
