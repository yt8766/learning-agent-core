import { listSubgraphDescriptors, listWorkflowPresets } from '@agent/agents-supervisor';
import { WorkerRegistry } from '@agent/runtime';
import type { ArchitectureDescriptorRegistryEntry, RuntimeArchitectureRecord } from '@agent/shared';

import { buildKnowledgeDescriptor } from '../knowledge/runtime-knowledge-store';
import { createAgentAdminArchitectureRegistryEntry } from './admin-page-architecture.registry';
import { createAgentArchitectureRegistryEntry } from './agent-runtime-architecture.registry';
import { createAgentChatArchitectureRegistryEntry } from './chat-workspace-architecture.registry';
import { createKnowledgeArchitectureRegistry } from './knowledge-architecture.registry';
import { createProjectArchitectureRegistryEntry } from './project-architecture.registry';

export function createArchitectureDescriptorRegistry(input: {
  subgraphs: ReturnType<typeof listSubgraphDescriptors>;
  workflows: ReturnType<typeof listWorkflowPresets>;
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
    subgraphs: ReturnType<typeof listSubgraphDescriptors>;
    workflows: ReturnType<typeof listWorkflowPresets>;
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
