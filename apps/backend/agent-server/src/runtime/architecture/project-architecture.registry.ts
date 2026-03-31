import { listSubgraphDescriptors } from '@agent/agent-core';
import type {
  ArchitectureDescriptor,
  ArchitectureDescriptorRegistryEntry,
  ArchitectureEdgeDescriptor,
  ArchitectureNodeDescriptor
} from '@agent/shared';

import { buildKnowledgeDescriptor } from '../knowledge/runtime-knowledge-store';

export function buildProjectArchitectureDescriptor(input: {
  subgraphs: ReturnType<typeof listSubgraphDescriptors>;
  knowledgeDescriptor: ReturnType<typeof buildKnowledgeDescriptor>;
}): ArchitectureDescriptor {
  const nodes: ArchitectureNodeDescriptor[] = [
    { id: 'agent-chat', label: 'agent-chat\nOpenClaw 前线作战面', kind: 'frontend', subgraphId: 'frontends' },
    { id: 'agent-admin', label: 'agent-admin\n六大中心指挥面', kind: 'frontend', subgraphId: 'frontends' },
    { id: 'backend', label: 'backend / agent-server', kind: 'backend', subgraphId: 'runtime' },
    { id: 'worker', label: 'worker\n异步执行与恢复', kind: 'worker', subgraphId: 'runtime' },
    { id: 'agent-core', label: 'agent-core\nSupervisor + 六部 runtime', kind: 'runtime', subgraphId: 'runtime' },
    { id: 'wenyuan', label: '文渊阁\nmemory / history / trace / checkpoint', kind: 'data', subgraphId: 'storage' },
    { id: 'cangjing', label: '藏经阁\ncatalog / documents / chunks / vectors', kind: 'data', subgraphId: 'storage' },
    { id: 'tools', label: 'tool registry', kind: 'registry', subgraphId: 'infra' },
    { id: 'connectors', label: 'connectors / MCP capability registry', kind: 'connector', subgraphId: 'infra' }
  ];
  input.subgraphs.forEach(subgraph => {
    nodes.push({
      id: `subgraph-${subgraph.id}`,
      label: `${subgraph.displayName}\n${subgraph.owner}`,
      kind: 'runtime',
      subgraphId: 'runtime'
    });
  });

  const edges: ArchitectureEdgeDescriptor[] = [
    { from: 'agent-chat', to: 'backend', label: 'chat / approvals / recover / stream' },
    { from: 'agent-admin', to: 'backend', label: 'runtime / governance / architecture' },
    { from: 'backend', to: 'agent-core', label: 'runtime facade' },
    { from: 'worker', to: 'agent-core', label: 'background contract' },
    { from: 'agent-core', to: 'wenyuan', label: 'session memory / trace / checkpoint' },
    { from: 'agent-core', to: 'cangjing', label: 'knowledge retrieval / ingestion' },
    { from: 'agent-core', to: 'tools', label: 'tool lookup' },
    { from: 'agent-core', to: 'connectors', label: 'connector routing' },
    { from: 'backend', to: 'worker', label: 'queue / lease / retry' }
  ];
  input.subgraphs.forEach(subgraph => {
    edges.push({
      from: 'agent-core',
      to: `subgraph-${subgraph.id}`,
      label: subgraph.id
    });
  });

  return {
    id: 'project-architecture',
    title: '当前项目架构图',
    scope: 'project',
    direction: 'LR',
    sourceDescriptors: [
      'subgraph registry',
      'runtime host descriptor',
      'chat workspace descriptor',
      'admin page registry',
      ...input.knowledgeDescriptor.sourceDescriptors
    ],
    subgraphs: [
      { id: 'frontends', title: 'Frontends' },
      { id: 'runtime', title: 'Runtime Applications' },
      { id: 'storage', title: 'Knowledge & Memory' },
      { id: 'infra', title: 'Registries & Connectors' }
    ],
    nodes,
    edges
  };
}

export function createProjectArchitectureRegistryEntry(input: {
  subgraphs: ReturnType<typeof listSubgraphDescriptors>;
  knowledgeDescriptor: ReturnType<typeof buildKnowledgeDescriptor>;
}): ArchitectureDescriptorRegistryEntry {
  const sourceDescriptors = [
    'subgraph registry',
    'runtime host descriptor',
    'chat workspace descriptor',
    'admin page registry',
    ...input.knowledgeDescriptor.sourceDescriptors
  ];

  return {
    id: 'project',
    sourceDescriptors,
    build: () => buildProjectArchitectureDescriptor(input)
  };
}
