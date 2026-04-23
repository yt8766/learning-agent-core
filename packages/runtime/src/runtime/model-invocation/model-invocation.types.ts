import type { ModelInvocationRequest, ModelInvocationResult, PreprocessDecision, ProviderUsage } from '@agent/core';

export type InvocationMessage = ModelInvocationRequest['messages'][number];

export interface ModelInvocationProfile {
  id: ModelInvocationRequest['modeProfile'];
  buildSystemMessages(request: ModelInvocationRequest): InvocationMessage[];
}

export interface ModelInvocationPreprocessorContext {
  request: ModelInvocationRequest;
  profile: ModelInvocationProfile;
}

export interface ModelInvocationPreprocessor {
  name: string;
  run(
    decision: PreprocessDecision,
    context: ModelInvocationPreprocessorContext
  ): Promise<PreprocessDecision> | PreprocessDecision;
}

export interface ModelInvocationProviderExecuteParams {
  request: ModelInvocationRequest;
  decision: PreprocessDecision;
  profile: ModelInvocationProfile;
  modelId: string;
  messages: InvocationMessage[];
}

export interface ModelInvocationProviderExecuteResult {
  providerId?: string;
  outputText: string;
  usage?: ProviderUsage;
  deliveryMeta?: Record<string, unknown>;
  providerMeta?: Record<string, unknown>;
}

export interface ModelInvocationProvider {
  execute(params: ModelInvocationProviderExecuteParams): Promise<ModelInvocationProviderExecuteResult>;
}

export interface ModelInvocationPipelineOptions {
  provider: ModelInvocationProvider;
  preprocessors?: ModelInvocationPreprocessor[];
  profiles?: ModelInvocationProfile[];
}

export type ModelInvocationFacadeOptions = ModelInvocationPipelineOptions;

export interface InvocationUsageRecord {
  invocationId: string;
  taskId?: string;
  sessionId?: string;
  modeProfile: ModelInvocationRequest['modeProfile'];
  stage: string;
  providerId: string;
  modelId: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUsd: number;
  costCny: number;
  selectedSkills: string[];
  selectedTools: string[];
  selectedMcpCapabilities: string[];
  cacheHit: boolean;
  fallback: boolean;
  retry: number;
}

export interface TaskUsageDelta {
  taskId?: string;
  sessionId?: string;
  invocationId: string;
  tokenDelta: number;
  costUsdDelta: number;
  costCnyDelta: number;
  totalTokenConsumed: number;
  totalCostConsumedUsd: number;
  totalCostConsumedCny: number;
}

export interface ModelInvocationTextOutput {
  kind: 'text';
  text: string;
}

export interface ModelInvocationTraceSummary {
  stage: string;
  modeProfile: ModelInvocationRequest['modeProfile'];
  modelId: string;
  providerId?: string;
  budgetDecision: PreprocessDecision['budgetDecision']['status'];
  cacheStatus: PreprocessDecision['cacheDecision']['status'];
  capabilityPlan: PreprocessDecision['capabilityInjectionPlan'];
  preprocessors?: string[];
  traceMeta: Record<string, unknown>;
}

export interface ModelInvocationPostprocessorContext {
  request: ModelInvocationRequest;
  decision: PreprocessDecision;
  providerResult: ModelInvocationProviderExecuteResult;
}

export interface UsageBillingPostprocessorResult {
  invocationUsageRecord: InvocationUsageRecord;
  taskUsageDelta: TaskUsageDelta;
}

export interface TraceAuditPostprocessorResult {
  traceSummary: ModelInvocationTraceSummary;
}

export interface OutputFinalizePostprocessorResult {
  finalOutput: ModelInvocationTextOutput;
  deliveryMeta: Record<string, unknown>;
}

export interface ModelInvocationPostprocessor<
  TResult = UsageBillingPostprocessorResult | TraceAuditPostprocessorResult | OutputFinalizePostprocessorResult
> {
  name: string;
  run(context: ModelInvocationPostprocessorContext): Promise<TResult> | TResult;
}

export interface ModelInvocationPipeline {
  invoke(request: ModelInvocationRequest): Promise<ModelInvocationResult>;
}

export const buildModelInvocationTraceSummary = ({
  request,
  decision,
  providerId,
  preprocessors,
  traceMeta = {}
}: {
  request: ModelInvocationRequest;
  decision: PreprocessDecision;
  providerId?: string;
  preprocessors?: string[];
  traceMeta?: Record<string, unknown>;
}): ModelInvocationTraceSummary => ({
  stage: request.stage,
  modeProfile: request.modeProfile,
  modelId: decision.resolvedModelId,
  ...(providerId ? { providerId } : {}),
  budgetDecision: decision.budgetDecision.status,
  cacheStatus: decision.cacheDecision.status,
  capabilityPlan: decision.capabilityInjectionPlan,
  ...(preprocessors ? { preprocessors } : {}),
  traceMeta: {
    ...decision.traceMeta,
    ...traceMeta
  }
});
