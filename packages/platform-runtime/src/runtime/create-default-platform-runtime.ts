import { AgentRuntime, type AgentRuntimeOptions } from '@agent/runtime';

import type { PlatformRuntimeFacade } from '../contracts';
import {
  createOfficialAgentRegistry,
  createOfficialRuntimeAgentDependencies,
  listSubgraphDescriptors,
  listWorkflowPresets,
  listWorkflowVersions
} from '../registries';
import { XingbuClassifier } from '../classifiers';
import { createPlatformRuntime } from './create-platform-runtime';

export function createDefaultPlatformRuntime(options: AgentRuntimeOptions = {}): PlatformRuntimeFacade<AgentRuntime> {
  const agentRegistry = createOfficialAgentRegistry();
  const agentDependencies = options.agentDependencies ?? createOfficialRuntimeAgentDependencies({ agentRegistry });

  return createPlatformRuntime({
    runtime: new AgentRuntime({
      ...options,
      agentDependencies,
      createApprovalClassifier:
        options.approvalClassifier || options.createApprovalClassifier
          ? options.createApprovalClassifier
          : llm => new XingbuClassifier(llm).classify
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
