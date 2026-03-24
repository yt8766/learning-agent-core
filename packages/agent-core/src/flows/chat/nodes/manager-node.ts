import { AgentRole, ManagerPlan, ReviewRecord } from '@agent/shared';

import { AgentRuntimeContext } from '../../../runtime/agent-runtime-context';
import {
  buildFallbackSupervisorPlan,
  buildSupervisorPlanUserPrompt,
  SUPERVISOR_DIRECT_REPLY_PROMPT,
  SUPERVISOR_PLAN_SYSTEM_PROMPT,
  SupervisorPlanSchema,
  toManagerPlan
} from '../../supervisor';
import { buildDeliverySummaryUserPrompt, DELIVERY_SUMMARY_SYSTEM_PROMPT } from '../../delivery';
import { BaseAgent } from '../base-agent';

export class ManagerAgent extends BaseAgent {
  constructor(context: AgentRuntimeContext) {
    super(AgentRole.MANAGER, context);
  }

  async plan(): Promise<ManagerPlan> {
    this.setStatus('running');

    const llmPlan = await this.generateObject(
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
        thinking: this.context.thinking.manager
      }
    );

    const plan = toManagerPlan(
      { taskId: this.context.taskId, goal: this.context.goal },
      llmPlan ?? buildFallbackSupervisorPlan({ taskId: this.context.taskId, goal: this.context.goal })
    );

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
        content: SUPERVISOR_DIRECT_REPLY_PROMPT
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
        content: DELIVERY_SUMMARY_SYSTEM_PROMPT
      },
      {
        role: 'user' as const,
        content: buildDeliverySummaryUserPrompt(this.context.goal, executionSummary, review.decision, review.notes)
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
