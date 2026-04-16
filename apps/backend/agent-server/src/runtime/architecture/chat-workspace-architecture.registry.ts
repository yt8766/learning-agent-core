import type { ArchitectureDescriptor, ArchitectureDescriptorRegistryEntry } from '@agent/core';

export function buildAgentChatArchitectureDescriptor(): ArchitectureDescriptor {
  return {
    id: 'agent-chat-architecture',
    title: 'agent-chat 架构图',
    scope: 'agentChat',
    direction: 'LR',
    sourceDescriptors: [
      'chat workspace descriptor',
      'frontend-backend integration descriptor',
      'checkpoint sync descriptor'
    ],
    subgraphs: [
      { id: 'workspace', title: 'OpenClaw Workspace' },
      { id: 'runtime', title: 'Runtime Bindings' }
    ],
    nodes: [
      { id: 'chat-thread', label: 'chat thread', kind: 'view', subgraphId: 'workspace' },
      { id: 'approvals', label: 'approval cards', kind: 'view', subgraphId: 'workspace' },
      { id: 'think', label: 'think panel', kind: 'view', subgraphId: 'workspace' },
      { id: 'evidence', label: 'evidence cards', kind: 'view', subgraphId: 'workspace' },
      { id: 'runtime-drawer', label: 'runtime drawer', kind: 'view', subgraphId: 'workspace' },
      { id: 'learning', label: 'learning suggestions', kind: 'view', subgraphId: 'workspace' },
      { id: 'stream', label: 'SSE stream', kind: 'runtime', subgraphId: 'runtime' },
      { id: 'checkpoint-sync', label: 'checkpoint sync', kind: 'runtime', subgraphId: 'runtime' },
      { id: 'recover', label: 'recover / cancel / resume', kind: 'runtime', subgraphId: 'runtime' }
    ],
    edges: [
      { from: 'chat-thread', to: 'approvals', label: 'message actions' },
      { from: 'chat-thread', to: 'think', label: 'thought chain' },
      { from: 'chat-thread', to: 'evidence', label: 'citations / sources' },
      { from: 'chat-thread', to: 'runtime-drawer', label: 'runtime summary' },
      { from: 'stream', to: 'chat-thread', label: 'delta / final' },
      { from: 'checkpoint-sync', to: 'runtime-drawer', label: 'critic / sandbox / final review' },
      { from: 'recover', to: 'chat-thread', label: 'recover actions' },
      { from: 'learning', to: 'chat-thread', label: 'confirm / defer' }
    ]
  };
}

export function createAgentChatArchitectureRegistryEntry(): ArchitectureDescriptorRegistryEntry {
  const sourceDescriptors = [
    'chat workspace descriptor',
    'frontend-backend integration descriptor',
    'checkpoint sync descriptor'
  ];

  return {
    id: 'agentChat',
    sourceDescriptors,
    build: () => buildAgentChatArchitectureDescriptor()
  };
}
