import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { RuntimeArchitecturePanel } from '@/features/runtime-overview/components/runtime-architecture-panel';

vi.mock('@/api/admin-api-platform', () => ({
  getRuntimeArchitecture: () =>
    Promise.resolve({
      project: {
        id: 'project',
        title: '当前项目架构图',
        generatedAt: '2026-03-31T10:00:00.000Z',
        version: '2026.03.runtime-architecture.v1',
        sourceDescriptors: ['subgraph registry'],
        descriptor: {
          id: 'project-architecture',
          title: '当前项目架构图',
          scope: 'project',
          direction: 'LR',
          sourceDescriptors: ['subgraph registry'],
          subgraphs: [],
          nodes: [{ id: 'agent-core', label: 'agent-core' }],
          edges: []
        },
        mermaid: 'flowchart LR\nagent_core["agent-core"]'
      },
      agent: {
        id: 'agent',
        title: 'Agent 架构图',
        generatedAt: '2026-03-31T10:00:00.000Z',
        version: '2026.03.runtime-architecture.v1',
        sourceDescriptors: ['workflow route registry'],
        descriptor: {
          id: 'agent-architecture',
          title: 'Agent 架构图',
          scope: 'agent',
          direction: 'TD',
          sourceDescriptors: ['workflow route registry'],
          subgraphs: [],
          nodes: [{ id: 'critic', label: 'Critic' }],
          edges: []
        },
        mermaid: 'flowchart TD\ncritic["Critic"]'
      },
      agentChat: {
        id: 'agentChat',
        title: 'agent-chat 架构图',
        generatedAt: '2026-03-31T10:00:00.000Z',
        version: '2026.03.runtime-architecture.v1',
        sourceDescriptors: ['chat workspace descriptor'],
        descriptor: {
          id: 'agent-chat-architecture',
          title: 'agent-chat 架构图',
          scope: 'agentChat',
          direction: 'LR',
          sourceDescriptors: ['chat workspace descriptor'],
          subgraphs: [],
          nodes: [{ id: 'chat-thread', label: 'chat thread' }],
          edges: []
        },
        mermaid: 'flowchart LR\nchat_thread["chat thread"]'
      },
      agentAdmin: {
        id: 'agentAdmin',
        title: 'agent-admin 架构图',
        generatedAt: '2026-03-31T10:00:00.000Z',
        version: '2026.03.runtime-architecture.v1',
        sourceDescriptors: ['admin page registry'],
        descriptor: {
          id: 'agent-admin-architecture',
          title: 'agent-admin 架构图',
          scope: 'agentAdmin',
          direction: 'TD',
          sourceDescriptors: ['admin page registry'],
          subgraphs: [],
          nodes: [{ id: 'architecture-view', label: 'Architecture View' }],
          edges: []
        },
        mermaid: 'flowchart TD\narchitecture_view["Architecture View"]'
      }
    })
}));

describe('RuntimeArchitecturePanel', () => {
  it('renders architecture workspace shell and tab labels', () => {
    const html = renderToStaticMarkup(<RuntimeArchitecturePanel />);

    expect(html).toContain('Architecture View');
    expect(html).toContain('结构化描述驱动的架构可视化');
    expect(html).toContain('当前项目');
    expect(html).toContain('agent-chat');
    expect(html).toContain('重新生成');
  });
});
