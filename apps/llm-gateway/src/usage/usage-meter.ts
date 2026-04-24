import type { GatewayChatMessage, GatewayUsage } from '../providers/provider-adapter';

export function estimateRequestTokens(messages: GatewayChatMessage[]): number {
  return Math.max(
    1,
    messages.reduce((total, message) => total + Math.ceil(message.content.length / 4) + 4, 0)
  );
}

export function isDailyBudgetAvailable(input: { used: number; limit?: number | null; estimated: number }): boolean {
  if (input.limit === null || input.limit === undefined) {
    return true;
  }

  return input.used + input.estimated <= input.limit;
}

export function estimateCompletionCost(input: {
  promptTokens: number;
  completionTokens: number;
  inputPricePer1mTokens?: number | null;
  outputPricePer1mTokens?: number | null;
}): number {
  const inputCost = (input.promptTokens / 1_000_000) * (input.inputPricePer1mTokens ?? 0);
  const outputCost = (input.completionTokens / 1_000_000) * (input.outputPricePer1mTokens ?? 0);

  return Number((inputCost + outputCost).toFixed(8));
}

export function estimateUsageCost(
  usage: GatewayUsage,
  prices: {
    inputPricePer1mTokens?: number | null;
    outputPricePer1mTokens?: number | null;
  }
): number {
  return estimateCompletionCost({
    promptTokens: usage.prompt_tokens,
    completionTokens: usage.completion_tokens,
    inputPricePer1mTokens: prices.inputPricePer1mTokens,
    outputPricePer1mTokens: prices.outputPricePer1mTokens
  });
}
