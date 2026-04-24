import type {
  ModelInvocationPostprocessor,
  ModelInvocationPostprocessorContext,
  UsageBillingPostprocessorResult
} from '../model-invocation.types';

const USD_TO_CNY_RATE = 7.2;

const readNumber = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) ? value : 0);

const readUsage = (context: ModelInvocationPostprocessorContext) => {
  const usage = context.providerResult.usage;
  const costUsd = readNumber(usage?.costUsd);
  const providerCostCny = normalizeOptionalNumber(usage?.costCny);
  const costCny = providerCostCny ?? roundCurrency(costUsd * USD_TO_CNY_RATE);
  return {
    promptTokens: readNumber(usage?.promptTokens),
    completionTokens: readNumber(usage?.completionTokens),
    totalTokens: readNumber(usage?.totalTokens),
    costUsd,
    costCny
  };
};

const roundCurrency = (value: number): number => Number(value.toFixed(6));
const normalizeOptionalNumber = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

const readBudgetCostCny = (context: ModelInvocationPostprocessorContext): number => {
  const budgetSnapshot = context.request.budgetSnapshot as Record<string, unknown>;
  const explicitCostCny = normalizeOptionalNumber(budgetSnapshot.costConsumedCny);
  if (typeof explicitCostCny === 'number') {
    return explicitCostCny;
  }
  return roundCurrency(readNumber(budgetSnapshot.costConsumedUsd) * USD_TO_CNY_RATE);
};

export class UsageBillingPostprocessor implements ModelInvocationPostprocessor<UsageBillingPostprocessorResult> {
  readonly name = 'usage-billing';

  run({ request, decision, providerResult }: ModelInvocationPostprocessorContext): UsageBillingPostprocessorResult {
    const usage = readUsage({ request, decision, providerResult });
    const totalTokenConsumed = (request.budgetSnapshot.tokenConsumed ?? 0) + usage.totalTokens;
    const totalCostConsumedUsd = roundCurrency((request.budgetSnapshot.costConsumedUsd ?? 0) + usage.costUsd);
    const totalCostConsumedCny = roundCurrency(
      readBudgetCostCny({ request, decision, providerResult }) + usage.costCny
    );
    const retry =
      typeof decision.traceMeta.retry === 'number' && Number.isFinite(decision.traceMeta.retry)
        ? decision.traceMeta.retry
        : 0;

    return {
      invocationUsageRecord: {
        invocationId: request.invocationId,
        taskId: request.taskId,
        sessionId: request.sessionId,
        modeProfile: request.modeProfile,
        stage: request.stage,
        providerId: providerResult.providerId ?? 'unknown-provider',
        modelId: decision.resolvedModelId,
        promptTokens: usage.promptTokens,
        completionTokens: usage.completionTokens,
        totalTokens: usage.totalTokens,
        costUsd: usage.costUsd,
        costCny: usage.costCny,
        selectedSkills: decision.capabilityInjectionPlan.selectedSkills,
        selectedTools: decision.capabilityInjectionPlan.selectedTools,
        selectedMcpCapabilities: decision.capabilityInjectionPlan.selectedMcpCapabilities,
        cacheHit: decision.cacheDecision.status === 'hit',
        fallback: decision.budgetDecision.status === 'fallback',
        retry
      },
      taskUsageDelta: {
        taskId: request.taskId,
        sessionId: request.sessionId,
        invocationId: request.invocationId,
        tokenDelta: usage.totalTokens,
        costUsdDelta: usage.costUsd,
        costCnyDelta: usage.costCny,
        totalTokenConsumed,
        totalCostConsumedUsd,
        totalCostConsumedCny
      }
    };
  }
}
