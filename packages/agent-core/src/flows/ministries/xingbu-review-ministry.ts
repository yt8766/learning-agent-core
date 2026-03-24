import { z } from 'zod/v4';

import {
  AgentExecutionState,
  AgentRole,
  EvaluationResult,
  ReviewDecision,
  ReviewRecord,
  ToolExecutionResult
} from '@agent/shared';
import { evaluateExecution } from '@agent/evals';

import { AgentRuntimeContext } from '../../runtime/agent-runtime-context';

export class XingbuReviewMinistry {
  private readonly state: AgentExecutionState;

  constructor(private readonly context: AgentRuntimeContext) {
    this.state = {
      agentId: `xingbu_review_${context.taskId}`,
      role: AgentRole.REVIEWER,
      goal: context.goal,
      plan: [],
      toolCalls: [],
      observations: [],
      shortTermMemory: [],
      longTermMemoryRefs: [],
      status: 'idle'
    };
  }

  async review(
    executionResult: ToolExecutionResult | undefined,
    executionSummary: string
  ): Promise<{ review: ReviewRecord; evaluation: EvaluationResult }> {
    this.state.status = 'running';
    this.state.subTask = '评审执行质量';
    const baseline = executionResult
      ? evaluateExecution(executionResult)
      : {
          success: false,
          quality: 'low' as const,
          shouldRetry: false,
          shouldWriteMemory: false,
          shouldCreateRule: true,
          shouldExtractSkill: false,
          notes: ['执行尚未真正发生，因为当前动作需要人工审批。']
        };

    const reviewSchema = z.object({
      decision: z.enum(['approved', 'retry', 'blocked']),
      quality: z.enum(['low', 'medium', 'high']),
      shouldRetry: z.boolean(),
      shouldWriteMemory: z.boolean(),
      shouldCreateRule: z.boolean(),
      shouldExtractSkill: z.boolean(),
      notes: z.array(z.string()).min(1)
    });

    let llmReview: z.infer<typeof reviewSchema> | null = null;
    if (executionResult && this.context.llm.isConfigured()) {
      try {
        llmReview = await this.context.llm.generateObject(
          [
            {
              role: 'system',
              content:
                '你是刑部尚书。请始终使用中文，判断执行结果应通过、重试还是阻断，并决定是否写入记忆、规则或技能候选。'
            },
            {
              role: 'user',
              content: JSON.stringify({
                goal: this.context.goal,
                executionSummary,
                baseline
              })
            }
          ],
          reviewSchema,
          {
            role: 'reviewer',
            thinking: this.context.thinking.reviewer,
            temperature: 0.1,
            onUsage: usage => {
              this.context.onUsage?.({
                usage,
                role: 'reviewer'
              });
            }
          }
        );
      } catch {
        llmReview = null;
      }
    }

    const decision: ReviewDecision =
      llmReview?.decision ??
      (executionResult ? (baseline.success ? 'approved' : baseline.shouldRetry ? 'retry' : 'blocked') : 'blocked');
    const evaluation: EvaluationResult = {
      success: decision === 'approved' && baseline.success,
      quality: llmReview?.quality ?? baseline.quality,
      shouldRetry: llmReview?.shouldRetry ?? baseline.shouldRetry,
      shouldWriteMemory: llmReview?.shouldWriteMemory ?? baseline.shouldWriteMemory,
      shouldCreateRule: llmReview?.shouldCreateRule ?? baseline.shouldCreateRule,
      shouldExtractSkill: llmReview?.shouldExtractSkill ?? baseline.shouldExtractSkill,
      notes: llmReview?.notes ?? baseline.notes
    };

    this.state.evaluation = evaluation;
    this.state.observations = evaluation.notes;
    this.state.shortTermMemory = [...evaluation.notes];
    this.state.finalOutput = executionSummary;
    this.state.status = decision === 'approved' ? 'completed' : 'failed';

    return {
      evaluation,
      review: {
        taskId: this.context.taskId,
        decision,
        notes: evaluation.notes,
        createdAt: new Date().toISOString()
      }
    };
  }

  getState(): AgentExecutionState {
    return this.state;
  }
}
