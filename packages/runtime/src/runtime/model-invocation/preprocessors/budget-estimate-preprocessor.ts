import type { PreprocessDecision } from '@agent/core';

import type { ModelInvocationPreprocessor } from '../model-invocation.types';

const estimateInputTokens = (contents: string[]): number => Math.max(1, Math.ceil(contents.join(' ').length / 4));

const normalizeEstimatedTokenCount = (value: unknown): number | undefined => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return undefined;
  }
  return Math.max(1, Math.ceil(value));
};

const resolveEstimatedInputTokens = async (
  decision: PreprocessDecision,
  context: Parameters<NonNullable<ModelInvocationPreprocessor['run']>>[1]
): Promise<number> => {
  const estimatedFromProvider = normalizeEstimatedTokenCount(
    await context.provider.estimateTokens?.({
      request: context.request,
      decision,
      profile: context.profile,
      modelId: decision.resolvedModelId,
      messages: decision.resolvedMessages
    })
  );

  if (typeof estimatedFromProvider === 'number') {
    return estimatedFromProvider;
  }

  return estimateInputTokens(decision.resolvedMessages.map(message => message.content));
};

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
  async run(decision, context): Promise<PreprocessDecision> {
    const estimatedInputTokens = await resolveEstimatedInputTokens(decision, context);
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
