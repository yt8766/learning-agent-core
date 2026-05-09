import {
  AgentExecutionState,
  AgentRole,
  CritiqueResultRecord,
  ReviewRecord,
  ReviewDecision,
  SpecialistFindingRecord
} from '@agent/core';
import { evaluateExecution } from '@agent/evals';
import type { EvaluationResult } from '@agent/core';

import { AgentRuntimeContext } from '../../runtime/agent-runtime-context';
import { withReactiveContextRetry } from '../../utils/reactive-context-retry';
import { normalizeCritiqueResult } from '../../shared/schemas/critique-result-schema';
import { generateObjectWithRetry } from '../../utils/llm-retry';
import { safeGenerateObject, type StructuredContractMeta } from '../../utils/schemas/safe-generate-object';
import { XINGBU_REVIEW_SYSTEM_PROMPT } from './xingbu-review/prompts/review-prompts';
import { ReviewDecisionOutput, ReviewDecisionSchema } from './xingbu-review/schemas/review-decision-schema';
import type { ToolExecutionResult } from '@agent/runtime';

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
  ): Promise<{
    review: ReviewRecord;
    evaluation: EvaluationResult;
    critiqueResult?: CritiqueResultRecord;
    specialistFinding?: SpecialistFindingRecord;
    contractMeta: StructuredContractMeta;
  }> {
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

    const structuredReview = executionResult
      ? await safeGenerateObject<ReviewDecisionOutput>({
          contractName: 'review-decision',
          contractVersion: 'review-decision.v1',
          isConfigured: this.context.llm.isConfigured(),
          schema: ReviewDecisionSchema,
          invoke: async () =>
            withReactiveContextRetry({
              context: this.context,
              trigger: 'xingbu-review',
              messages: [
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
              invoke: async retryMessages =>
                generateObjectWithRetry({
                  llm: this.context.llm,
                  contractName: 'review-decision',
                  contractVersion: 'review-decision.v1',
                  messages: retryMessages,
                  schema: ReviewDecisionSchema,
                  options: {
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
                })
            })
        })
      : {
          object: null,
          meta: {
            contractName: 'review-decision',
            contractVersion: 'review-decision.v1',
            parseStatus: 'not_configured' as const,
            fallbackUsed: true,
            fallbackReason: 'No execution result available for structured review.'
          }
        };
    const llmReview = structuredReview.object;

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
      },
      critiqueResult: llmReview?.critiqueResult ? normalizeCritiqueResult(llmReview.critiqueResult) : undefined,
      specialistFinding: llmReview?.specialistFinding
        ? ({
            ...llmReview.specialistFinding,
            contractVersion: 'specialist-finding.v1',
            source: 'critique',
            stage: 'review'
          } satisfies SpecialistFindingRecord)
        : undefined,
      contractMeta: structuredReview.meta
    };
  }

  getState(): AgentExecutionState {
    return this.state;
  }
}
