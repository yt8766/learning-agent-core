import type { GatewayUsage } from '../providers/provider-adapter.js';
import type { UsageSource } from './usage-accounting.js';

export type InvocationLogStatus = 'success' | 'error';

export interface BuildInvocationLogInput {
  keyId: string;
  requestedModel: string;
  model: string;
  providerModel: string;
  provider: string;
  status: InvocationLogStatus;
  usage: GatewayUsage;
  estimatedCost: number;
  usageSource: UsageSource;
  latencyMs: number;
  stream: boolean;
  fallbackAttemptCount: number;
  errorCode?: string;
  errorMessage?: string;
}

export interface InvocationLog {
  keyId: string;
  requestedModel: string;
  model: string;
  providerModel: string;
  provider: string;
  status: InvocationLogStatus;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCost: number;
  usageSource: UsageSource;
  latencyMs: number;
  stream: boolean;
  fallbackAttemptCount: number;
  errorCode?: string;
  errorMessage?: string;
}

export function buildInvocationLog(input: BuildInvocationLogInput): InvocationLog {
  return {
    keyId: input.keyId,
    requestedModel: input.requestedModel,
    model: input.model,
    providerModel: input.providerModel,
    provider: input.provider,
    status: input.status,
    promptTokens: input.usage.prompt_tokens,
    completionTokens: input.usage.completion_tokens,
    totalTokens: input.usage.total_tokens,
    estimatedCost: input.estimatedCost,
    usageSource: input.usageSource,
    latencyMs: input.latencyMs,
    stream: input.stream,
    fallbackAttemptCount: input.fallbackAttemptCount,
    ...(input.errorCode ? { errorCode: input.errorCode } : {}),
    ...(input.errorMessage ? { errorMessage: input.errorMessage } : {})
  };
}
