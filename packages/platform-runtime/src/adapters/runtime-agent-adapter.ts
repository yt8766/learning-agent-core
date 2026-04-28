import type { AgentProvider, PlatformAgentDescriptor } from '@agent/runtime';

export interface RuntimeAgentAdapterOptions<TAgent> {
  readonly descriptor: PlatformAgentDescriptor;
  readonly createAgent: () => TAgent | Promise<TAgent>;
}

export function createRuntimeAgentProvider<TAgent>(options: RuntimeAgentAdapterOptions<TAgent>): AgentProvider<TAgent> {
  return {
    descriptor: options.descriptor,
    createAgent: options.createAgent
  };
}
