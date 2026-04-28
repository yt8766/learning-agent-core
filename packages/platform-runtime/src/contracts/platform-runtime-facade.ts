import type { WorkflowPresetDefinition, WorkflowVersionRecord } from '@agent/core';
import type { AgentRegistry, RuntimeAgentDependencies } from '@agent/runtime';

export interface SubgraphDescriptor {
  readonly id: string;
  readonly displayName: string;
  readonly description: string;
  readonly owner: string;
  readonly entryNodes: readonly string[];
}

export interface PlatformRuntimeMetadata {
  readonly listWorkflowPresets: () => WorkflowPresetDefinition[];
  readonly listSubgraphDescriptors: () => SubgraphDescriptor[];
  readonly listWorkflowVersions: () => WorkflowVersionRecord[];
}

export interface PlatformRuntimeFacade<TRuntime = unknown> {
  readonly runtime: TRuntime;
  readonly agentRegistry: AgentRegistry;
  readonly agentDependencies: RuntimeAgentDependencies;
  readonly metadata: PlatformRuntimeMetadata;
}

export interface CreatePlatformRuntimeOptions<TRuntime = unknown> {
  readonly runtime: TRuntime;
  readonly agentRegistry?: AgentRegistry;
  readonly agentDependencies: RuntimeAgentDependencies;
  readonly metadata?: PlatformRuntimeMetadata;
}
