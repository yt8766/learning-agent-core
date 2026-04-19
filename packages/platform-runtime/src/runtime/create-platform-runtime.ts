import type { AgentRegistry } from '@agent/agent-kit';
import type { PlatformRuntimeFacade, CreatePlatformRuntimeOptions } from '../contracts';
import type { OfficialPlatformAgentModule } from '../registries';
import {
  createOfficialAgentRegistry,
  createOfficialRuntimeAgentDependencies,
  listSubgraphDescriptors,
  listWorkflowPresets,
  listWorkflowVersions
} from '../registries';

export function createPlatformRuntime<TRuntime>(
  options: CreatePlatformRuntimeOptions<TRuntime>
): PlatformRuntimeFacade<TRuntime> {
  const agentRegistry = options.agentRegistry ?? createOfficialAgentRegistry();
  return {
    runtime: options.runtime,
    agentRegistry,
    agentDependencies:
      options.agentDependencies ??
      createOfficialRuntimeAgentDependencies({
        agentRegistry: agentRegistry as AgentRegistry<OfficialPlatformAgentModule>
      }),
    metadata: options.metadata ?? {
      listWorkflowPresets,
      listSubgraphDescriptors,
      listWorkflowVersions
    }
  };
}
