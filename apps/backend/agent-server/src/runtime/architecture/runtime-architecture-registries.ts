import { WorkerRegistry } from '@agent/runtime';
import type { ArchitectureDescriptorRegistryEntry, RuntimeArchitectureRecord } from '@agent/core';
import type { RuntimeHost } from '../core/runtime.host';

import { buildKnowledgeDescriptor } from '../domain/knowledge/runtime-knowledge-store';
import { createAgentAdminArchitectureRegistryEntry } from './admin-page-architecture.registry';
import { createAgentArchitectureRegistryEntry } from './agent-runtime-architecture.registry';
import { createAgentChatArchitectureRegistryEntry } from './chat-workspace-architecture.registry';
import { createKnowledgeArchitectureRegistry } from './knowledge-architecture.registry';
import { createProjectArchitectureRegistryEntry } from './project-architecture.registry';

export function createArchitectureDescriptorRegistry(input: {
  subgraphs: ReturnType<RuntimeHost['listSubgraphDescriptors']>;
  workflows: ReturnType<RuntimeHost['listWorkflowPresets']>;
  workers: ReturnType<WorkerRegistry['list']>;
  knowledgeDescriptor: ReturnType<typeof buildKnowledgeDescriptor>;
}): Record<keyof RuntimeArchitectureRecord, ArchitectureDescriptorRegistryEntry> {
  const knowledgeRegistry = createKnowledgeArchitectureRegistry({
    knowledgeDescriptor: input.knowledgeDescriptor
  });

  return Object.fromEntries(
    discoverArchitectureDescriptorEntries(input, knowledgeRegistry).map(entry => [entry.id, entry])
  ) as Record<keyof RuntimeArchitectureRecord, ArchitectureDescriptorRegistryEntry>;
}

function discoverArchitectureDescriptorEntries(
  input: {
    subgraphs: ReturnType<RuntimeHost['listSubgraphDescriptors']>;
    workflows: ReturnType<RuntimeHost['listWorkflowPresets']>;
    workers: ReturnType<WorkerRegistry['list']>;
    knowledgeDescriptor: ReturnType<typeof buildKnowledgeDescriptor>;
  },
  knowledgeRegistry: ReturnType<typeof createKnowledgeArchitectureRegistry>
) {
  return [
    createProjectArchitectureRegistryEntry({
      subgraphs: input.subgraphs,
      knowledgeDescriptor: input.knowledgeDescriptor
    }),
    createAgentArchitectureRegistryEntry({
      workflows: input.workflows,
      workers: input.workers
    }),
    createAgentChatArchitectureRegistryEntry(),
    createAgentAdminArchitectureRegistryEntry({
      knowledgeDescriptor: {
        ...input.knowledgeDescriptor,
        sourceDescriptors: [...knowledgeRegistry.sourceDescriptors]
      }
    })
  ];
}
