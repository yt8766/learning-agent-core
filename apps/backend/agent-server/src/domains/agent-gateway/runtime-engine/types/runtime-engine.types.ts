import type {
  GatewayOpenAIModelsResponse,
  GatewayRuntimeHealthResponse,
  GatewayRuntimeInvocation,
  GatewayRuntimeProviderKind,
  GatewayRuntimeRouteDecision,
  GatewayRuntimeStreamEvent
} from '@agent/core';

export type RuntimeEngineHealth = GatewayRuntimeHealthResponse;

export interface GatewayRuntimeDiscoveredModel {
  id: string;
  ownedBy: string;
  created: number;
}

export interface RuntimeEngineInvokeResult {
  invocationId: string;
  model: string;
  text: string;
  route: GatewayRuntimeRouteDecision;
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  diagnostic?: string;
}

export interface RuntimeEngineExecutionContext {
  providerKind?: GatewayRuntimeProviderKind;
  signal?: AbortSignal;
}

export interface ProcessProviderRuntimeCommandPlan {
  commandProfile: string;
  invocation: GatewayRuntimeInvocation;
  timeoutMs?: number;
  signal?: AbortSignal;
}

export interface ProcessProviderRuntimeCommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface GatewayRuntimeExecutor {
  readonly providerKind: GatewayRuntimeProviderKind;
  health(): Promise<RuntimeEngineHealth['executors'][number]>;
  discoverModels(): Promise<GatewayRuntimeDiscoveredModel[]>;
  canHandle(invocation: GatewayRuntimeInvocation, context?: RuntimeEngineExecutionContext): boolean;
  invoke(
    invocation: GatewayRuntimeInvocation,
    context?: RuntimeEngineExecutionContext
  ): Promise<RuntimeEngineInvokeResult>;
  stream(
    invocation: GatewayRuntimeInvocation,
    context?: RuntimeEngineExecutionContext
  ): AsyncIterable<GatewayRuntimeStreamEvent>;
}

export interface RuntimeEnginePort {
  health(): Promise<RuntimeEngineHealth>;
  listModels(): Promise<GatewayOpenAIModelsResponse>;
  invoke(
    invocation: GatewayRuntimeInvocation,
    context?: RuntimeEngineExecutionContext
  ): Promise<RuntimeEngineInvokeResult>;
  stream(
    invocation: GatewayRuntimeInvocation,
    context?: RuntimeEngineExecutionContext
  ): AsyncIterable<GatewayRuntimeStreamEvent>;
}
