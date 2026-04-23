import type { PreprocessDecision } from '@agent/core';

import type { ModelInvocationPreprocessor } from '../model-invocation.types';

const estimateInputTokens = (contents: string[]): number => Math.max(1, Math.ceil(contents.join(' ').length / 4));

const buildBudgetDecision = ({
  estimatedInputTokens,
  fallbackModelId,
  denyReason,
  decision
}: {
  estimatedInputTokens: number;
  fallbackModelId?: string;
  denyReason: string;
  decision: PreprocessDecision;
}): PreprocessDecision => {
  if (fallbackModelId) {
    return {
      ...decision,
      resolvedModelId: fallbackModelId,
      budgetDecision: {
        status: 'fallback',
        estimatedInputTokens,
        fallbackModelId
      }
    };
  }

  return {
    ...decision,
    allowExecution: false,
    denyReason,
    budgetDecision: {
      status: 'deny',
      estimatedInputTokens
    }
  };
};

export const budgetEstimatePreprocessor: ModelInvocationPreprocessor = {
  name: 'budget-estimate',
  run(decision, context): PreprocessDecision {
    const estimatedInputTokens = estimateInputTokens(decision.resolvedMessages.map(message => message.content));
    const costConsumedUsd = context.request.budgetSnapshot.costConsumedUsd;
    const costBudgetUsd = context.request.budgetSnapshot.costBudgetUsd;
    const tokenBudget = context.request.budgetSnapshot.tokenBudget;
    const fallbackModelId = context.request.budgetSnapshot.fallbackModelId;

    if (typeof costConsumedUsd === 'number' && typeof costBudgetUsd === 'number' && costConsumedUsd >= costBudgetUsd) {
      return buildBudgetDecision({
        estimatedInputTokens,
        fallbackModelId,
        denyReason: 'cost budget exceeded',
        decision
      });
    }

    if (typeof tokenBudget === 'number' && estimatedInputTokens > tokenBudget) {
      return buildBudgetDecision({
        estimatedInputTokens,
        fallbackModelId,
        denyReason: 'token budget exceeded',
        decision
      });
    }

    return {
      ...decision,
      budgetDecision: {
        status: 'allow',
        estimatedInputTokens
      }
    };
  }
};
