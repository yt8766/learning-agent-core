import { listSubgraphDescriptors } from '@agent/agents-supervisor';
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
    { id: 'runtime-host', label: 'runtime-host\nSupervisor + 六部 runtime', kind: 'runtime', subgraphId: 'runtime' },
    { id: 'wenyuan', label: '文渊阁\nmemory / history / trace / checkpoint', kind: 'data', subgraphId: 'storage' },
    { id: 'cangjing', label: '藏经阁\ncatalog / documents / chunks / vectors', kind: 'data', subgraphId: 'storage' },
    { id: 'tools', label: 'tool registry', kind: 'registry', subgraphId: 'infra' },
    { id: 'connectors', label: 'connectors / MCP capability registry', kind: 'connector', subgraphId: 'infra' }
  ];
  input.subgraphs.forEach(subgraph => {
    nodes.push({
      id: `runtime-unit-${subgraph.id}`,
      label: `${subgraph.displayName}\n${subgraph.owner}`,
      kind: 'runtime',
      subgraphId: 'runtime'
    });
  });

  const edges: ArchitectureEdgeDescriptor[] = [
    { from: 'agent-chat', to: 'backend', label: 'chat / approvals / recover / stream' },
    { from: 'agent-admin', to: 'backend', label: 'runtime / governance / architecture' },
    { from: 'backend', to: 'runtime-host', label: 'runtime facade' },
    { from: 'worker', to: 'runtime-host', label: 'background contract' },
    { from: 'runtime-host', to: 'wenyuan', label: 'session memory / trace / checkpoint' },
    { from: 'runtime-host', to: 'cangjing', label: 'knowledge retrieval / ingestion' },
    { from: 'runtime-host', to: 'tools', label: 'tool lookup' },
    { from: 'runtime-host', to: 'connectors', label: 'connector routing' },
    { from: 'backend', to: 'worker', label: 'queue / lease / retry' }
  ];
  input.subgraphs.forEach(subgraph => {
    edges.push({
      from: 'runtime-host',
      to: `runtime-unit-${subgraph.id}`,
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
