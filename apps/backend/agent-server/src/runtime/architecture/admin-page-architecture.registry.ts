import type { ArchitectureDescriptor, ArchitectureDescriptorRegistryEntry } from '@agent/core';

import { buildKnowledgeDescriptor } from '../knowledge/runtime-knowledge-store';

export function buildAgentAdminArchitectureDescriptor(input: {
  knowledgeDescriptor: ReturnType<typeof buildKnowledgeDescriptor>;
}): ArchitectureDescriptor {
  return {
    id: 'agent-admin-architecture',
    title: 'agent-admin 架构图',
    scope: 'agentAdmin',
    direction: 'TD',
    sourceDescriptors: [
      'admin page registry',
      'runtime center descriptor',
      ...input.knowledgeDescriptor.sourceDescriptors
    ],
    subgraphs: [
      { id: 'centers', title: 'Six Centers' },
      { id: 'sources', title: 'Runtime & Governance Sources' }
    ],
    nodes: [
      { id: 'runtime-center', label: 'Runtime Center', kind: 'view', subgraphId: 'centers' },
      { id: 'approvals-center', label: 'Approvals Center', kind: 'view', subgraphId: 'centers' },
      { id: 'learning-center', label: 'Learning Center', kind: 'view', subgraphId: 'centers' },
      { id: 'skill-lab', label: 'Skill Lab', kind: 'view', subgraphId: 'centers' },
      { id: 'evidence-center', label: 'Evidence Center', kind: 'view', subgraphId: 'centers' },
      { id: 'connector-policy', label: 'Connector & Policy Center', kind: 'view', subgraphId: 'centers' },
      { id: 'architecture-view', label: 'Architecture View', kind: 'view', subgraphId: 'centers' },
      { id: 'runtime-contract', label: 'runtime contract', kind: 'runtime', subgraphId: 'sources' },
      { id: 'governance-report', label: 'governance report', kind: 'governance', subgraphId: 'sources' },
      { id: 'wenyuan-source', label: '文渊阁 facade', kind: 'data', subgraphId: 'sources' },
      { id: 'cangjing-source', label: '藏经阁 indexes', kind: 'data', subgraphId: 'sources' }
    ],
    edges: [
      { from: 'runtime-contract', to: 'runtime-center' },
      { from: 'runtime-contract', to: 'approvals-center' },
      { from: 'governance-report', to: 'learning-center' },
      { from: 'governance-report', to: 'skill-lab' },
      { from: 'wenyuan-source', to: 'evidence-center' },
      { from: 'cangjing-source', to: 'connector-policy' },
      { from: 'runtime-contract', to: 'architecture-view', label: 'diagram descriptors' },
      { from: 'governance-report', to: 'architecture-view', label: 'version / generatedAt' }
    ]
  };
}

export function createAgentAdminArchitectureRegistryEntry(input: {
  knowledgeDescriptor: ReturnType<typeof buildKnowledgeDescriptor>;
}): ArchitectureDescriptorRegistryEntry {
  const sourceDescriptors = [
    'admin page registry',
    'runtime center descriptor',
    ...input.knowledgeDescriptor.sourceDescriptors
  ];

  return {
    id: 'agentAdmin',
    sourceDescriptors,
    build: () => buildAgentAdminArchitectureDescriptor(input)
  };
}
