import type { AgentRegistry } from '@agent/agent-kit';
import type { WorkflowPresetDefinition, WorkflowVersionRecord } from '@agent/core';
import type { SubgraphDescriptor } from '@agent/agents-supervisor';
import type { RuntimeAgentDependencies } from '@agent/runtime';

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
  readonly agentDependencies?: RuntimeAgentDependencies;
  readonly metadata?: PlatformRuntimeMetadata;
}
