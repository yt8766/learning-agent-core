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
import { XINGBU_REVIEW_SYSTEM_PROMPT } from './xingbu-review/prompts/review-prompts';
import { ReviewDecisionSchema } from './xingbu-review/schemas/review-decision-schema';

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

    let llmReview: {
      decision: ReviewDecision;
      quality: 'low' | 'medium' | 'high';
      shouldRetry: boolean;
      shouldWriteMemory: boolean;
      shouldCreateRule: boolean;
      shouldExtractSkill: boolean;
      notes: string[];
    } | null = null;
    if (executionResult && this.context.llm.isConfigured()) {
      try {
        llmReview = await this.context.llm.generateObject(
          [
            {
              role: 'system',
              content: XINGBU_REVIEW_SYSTEM_PROMPT
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
          ReviewDecisionSchema,
          {
            role: 'reviewer',
            modelId: this.context.currentWorker?.defaultModel,
            taskId: this.context.taskId,
            thinking: this.context.thinking.reviewer,
            temperature: 0.1,
            budgetState: this.context.budgetState,
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
