import type { ILLMProvider } from '@agent/core';

import { createDefaultPlatformRuntime } from '../src/index.js';

const testLlmProvider: ILLMProvider = {
  providerId: 'test-provider',
  displayName: 'Test Provider',
  supportedModels: () => [],
  isConfigured: () => true,
  generateText: async () => 'ok',
  streamText: async () => 'ok',
  generateObject: async () => ({}) as never
};

const facade = createDefaultPlatformRuntime({
  llmProvider: testLlmProvider
});

console.log(
  JSON.stringify(
    {
      agentIds: facade.agentRegistry.listAgents().map(agent => agent.id),
      workflowPresetCount: facade.metadata.listWorkflowPresets().length,
      subgraphCount: facade.metadata.listSubgraphDescriptors().length,
      workflowVersionCount: facade.metadata.listWorkflowVersions().length
    },
    null,
    2
  )
);
