import { AgentRuntime, type AgentRuntimeOptions } from '@agent/runtime';

import type { PlatformRuntimeFacade } from '../contracts';
import {
  createOfficialAgentRegistry,
  createOfficialRuntimeAgentDependencies,
  listSubgraphDescriptors,
  listWorkflowPresets,
  listWorkflowVersions
} from '../registries';
import { createPlatformRuntime } from './create-platform-runtime';

export function createDefaultPlatformRuntime(options: AgentRuntimeOptions = {}): PlatformRuntimeFacade<AgentRuntime> {
  const agentRegistry = createOfficialAgentRegistry();
  const agentDependencies = options.agentDependencies ?? createOfficialRuntimeAgentDependencies({ agentRegistry });

  return createPlatformRuntime({
    runtime: new AgentRuntime({
      ...options,
      agentDependencies
    }),
    agentRegistry,
    agentDependencies,
    metadata: {
      listWorkflowPresets,
      listSubgraphDescriptors,
      listWorkflowVersions
    }
  });
}
