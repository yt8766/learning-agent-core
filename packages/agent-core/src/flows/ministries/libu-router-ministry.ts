import { AgentExecutionState, AgentRole, ManagerPlan, ReviewRecord } from '@agent/shared';

import { AgentRuntimeContext } from '../../runtime/agent-runtime-context';
import {
  buildFallbackSupervisorPlan,
  buildSupervisorDirectReplyUserPrompt,
  buildSupervisorPlanUserPrompt,
  inferDispatchKind,
  SUPERVISOR_DIRECT_REPLY_PROMPT,
  SUPERVISOR_PLAN_SYSTEM_PROMPT,
  SupervisorPlanSchema,
  toManagerPlan
} from '../supervisor';
import {
  buildDeliverySummaryUserPrompt,
  DELIVERY_SUMMARY_SYSTEM_PROMPT,
  sanitizeFinalUserReply,
  shapeFinalUserReply
} from '../delivery';
import { sanitizeTaskContextForModel } from '../../shared/prompts/runtime-output-sanitizer';

function appendTaskContext(content: string, taskContext?: string) {
  const sanitizedTaskContext = sanitizeTaskContextForModel(taskContext);
  if (!sanitizedTaskContext) {
    return content;
  }

  return [content, '以下是当前任务上下文：', sanitizedTaskContext].join('\n\n');
}

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

  private rememberIssue(note: string) {
    this.state.observations = [...this.state.observations, note];
    this.state.shortTermMemory = [...this.state.shortTermMemory, note];
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
              content: appendTaskContext(buildSupervisorPlanUserPrompt(this.context.goal), this.context.taskContext)
            }
          ],
          SupervisorPlanSchema,
          {
            role: 'manager',
            taskId: this.context.taskId,
            modelId: this.context.currentWorker?.defaultModel,
            budgetState: this.context.budgetState,
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
      } catch (error) {
        this.rememberIssue(`LLM plan fallback: ${error instanceof Error ? error.message : 'unknown error'}`);
        llmPlan = null;
      }
    } else {
      this.rememberIssue('LLM unavailable: no configured provider in current runtime');
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
      kind: inferDispatchKind(subTask),
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
        content: appendTaskContext(buildSupervisorDirectReplyUserPrompt(this.context.goal), this.context.taskContext)
      }
    ];

    let streamed: string | null = null;
    if (this.context.llm.isConfigured()) {
      try {
        streamed = await this.context.llm.streamText(
          promptMessages,
          {
            role: 'manager',
            taskId: this.context.taskId,
            modelId: this.context.currentWorker?.defaultModel,
            budgetState: this.context.budgetState,
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
      } catch (error) {
        this.rememberIssue(`LLM streaming fallback: ${error instanceof Error ? error.message : 'unknown error'}`);
        streamed = null;
      }
    } else {
      this.rememberIssue('LLM unavailable: no configured provider in current runtime');
    }

    let fallback: string | null = null;
    if (!streamed && this.context.llm.isConfigured()) {
      try {
        fallback = await this.context.llm.generateText(promptMessages, {
          role: 'manager',
          taskId: this.context.taskId,
          modelId: this.context.currentWorker?.defaultModel,
          budgetState: this.context.budgetState,
          thinking: this.context.thinking.manager,
          temperature: 0.2,
          onUsage: usage => {
            this.context.onUsage?.({
              usage,
              role: 'manager'
            });
          }
        });
      } catch (error) {
        this.rememberIssue(`LLM text fallback: ${error instanceof Error ? error.message : 'unknown error'}`);
        fallback = null;
      }
    }

    this.state.finalOutput = sanitizeFinalUserReply(
      streamed ?? fallback ?? '我是一个多 Agent 协作助手，负责理解你的目标、调度研究与执行能力，并用中文直接给你结果。'
    );
    this.state.status = 'completed';
    return this.state.finalOutput;
  }

  async finalize(
    review: ReviewRecord,
    executionSummary: string,
    freshnessSourceSummary?: string,
    citationSourceSummary?: string
  ): Promise<string> {
    const messageId = `summary_stream_${this.context.taskId}`;
    const promptMessages = [
      {
        role: 'system' as const,
        content: DELIVERY_SUMMARY_SYSTEM_PROMPT
      },
      {
        role: 'user' as const,
        content: appendTaskContext(
          buildDeliverySummaryUserPrompt(
            this.context.goal,
            executionSummary,
            review.decision,
            review.notes,
            freshnessSourceSummary,
            citationSourceSummary
          ),
          this.context.taskContext
        )
      }
    ];

    let llmSummary: string | null = null;
    if (this.context.llm.isConfigured()) {
      try {
        llmSummary = await this.context.llm.streamText(
          promptMessages,
          {
            role: 'manager',
            taskId: this.context.taskId,
            modelId: this.context.currentWorker?.defaultModel,
            budgetState: this.context.budgetState,
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
      } catch (error) {
        this.rememberIssue(`LLM finalize stream fallback: ${error instanceof Error ? error.message : 'unknown error'}`);
        llmSummary = null;
      }
    } else {
      this.rememberIssue('LLM unavailable: no configured provider in current runtime');
    }

    let fallbackSummary: string | null = null;
    if (!llmSummary && this.context.llm.isConfigured()) {
      try {
        fallbackSummary = await this.context.llm.generateText(promptMessages, {
          role: 'manager',
          taskId: this.context.taskId,
          modelId: this.context.currentWorker?.defaultModel,
          budgetState: this.context.budgetState,
          thinking: this.context.thinking.manager,
          temperature: 0.2,
          onUsage: usage => {
            this.context.onUsage?.({
              usage,
              role: 'manager'
            });
          }
        });
      } catch (error) {
        this.rememberIssue(`LLM finalize text fallback: ${error instanceof Error ? error.message : 'unknown error'}`);
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
    this.state.finalOutput = shapeFinalUserReply(
      llmSummary ?? fallbackSummary ?? executionSummary,
      citationSourceSummary,
      this.context.goal
    );
    this.state.status = 'completed';
    return this.state.finalOutput;
  }

  getState(): AgentExecutionState {
    return this.state;
  }
}
