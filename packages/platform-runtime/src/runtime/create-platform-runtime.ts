import type { PlatformRuntimeFacade, CreatePlatformRuntimeOptions } from '../contracts';
import { StaticAgentRegistry } from '../registries';

const EMPTY_PLATFORM_RUNTIME_METADATA = {
  listWorkflowPresets: () => [],
  listSubgraphDescriptors: () => [],
  listWorkflowVersions: () => []
};

export function createPlatformRuntime<TRuntime>(
  options: CreatePlatformRuntimeOptions<TRuntime>
): PlatformRuntimeFacade<TRuntime> {
  const agentRegistry = options.agentRegistry ?? new StaticAgentRegistry();
  return {
    runtime: options.runtime,
    agentRegistry,
    agentDependencies: options.agentDependencies,
    metadata: options.metadata ?? EMPTY_PLATFORM_RUNTIME_METADATA
  };
}
