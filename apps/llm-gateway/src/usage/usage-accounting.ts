import type { GatewayChatMessage, GatewayUsage } from '../providers/provider-adapter';
import { estimateRequestTokens, estimateUsageCost } from './usage-meter';

export type UsageSource = 'provider_final_usage' | 'stream_accumulated_usage' | 'gateway_estimated_usage';

export interface ResolvedUsage {
  source: UsageSource;
  usage: GatewayUsage;
}

export function resolveFinalUsage(input: {
  providerUsage?: GatewayUsage | null;
  streamAccumulatedUsage?: GatewayUsage | null;
  gatewayEstimatedUsage: GatewayUsage;
}): ResolvedUsage {
  if (input.providerUsage) {
    return {
      source: 'provider_final_usage',
      usage: input.providerUsage
    };
  }

  if (input.streamAccumulatedUsage) {
    return {
      source: 'stream_accumulated_usage',
      usage: input.streamAccumulatedUsage
    };
  }

  return {
    source: 'gateway_estimated_usage',
    usage: input.gatewayEstimatedUsage
  };
}

export function estimateStreamUsage(input: { messages: GatewayChatMessage[]; streamedContent: string }): GatewayUsage {
  const promptTokens = estimateRequestTokens(input.messages);
  const completionTokens = Math.max(1, Math.ceil(input.streamedContent.length / 4) + 4);

  return {
    prompt_tokens: promptTokens,
    completion_tokens: completionTokens,
    total_tokens: promptTokens + completionTokens
  };
}

export function calculateUsageCost(input: {
  usage: GatewayUsage;
  inputPricePer1mTokens?: number | null;
  outputPricePer1mTokens?: number | null;
}): number {
  return estimateUsageCost(input.usage, {
    inputPricePer1mTokens: input.inputPricePer1mTokens,
    outputPricePer1mTokens: input.outputPricePer1mTokens
  });
}
