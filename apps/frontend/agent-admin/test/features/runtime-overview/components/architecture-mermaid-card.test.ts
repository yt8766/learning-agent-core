import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { describe, expect, it } from 'vitest';

import {
  ArchitectureMermaidCard,
  sanitizeMermaidSource
} from '@/features/runtime-overview/components/architecture-mermaid-card';

describe('sanitizeMermaidSource', () => {
  it('normalizes legacy runtime architecture node ids before mermaid render', () => {
    const source = [
      'flowchart LR',
      'subgraph frontends [Frontends]',
      '  agent-chat["agent-chat<br/>OpenClaw 前线作战面"]',
      'end',
      'graph-node-research["Research Subgraph<br/>hubu-search"]',
      'agent-core -->|research| graph-node-research'
    ].join('\n');

    const sanitized = sanitizeMermaidSource(source);

    expect(sanitized).toContain('subgraph group_frontends [Frontends]');
    expect(sanitized).toContain('node_agent_chat["agent-chat<br/>OpenClaw 前线作战面"]');
    expect(sanitized).toContain('node_graph_node_research["Research Subgraph<br/>hubu-search"]');
    expect(sanitized).toContain('node_agent_core -->|research| node_graph_node_research');
  });

  it('renders the reference-style toolbar shell', () => {
    const html = renderToStaticMarkup(
      createElement(ArchitectureMermaidCard, {
        diagram: {
          id: 'project',
          title: '当前项目架构图',
          generatedAt: '2026-04-02T00:00:00.000Z',
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
          mermaid: 'flowchart LR\nagent-core["agent-core"]'
        }
      })
    );

    expect(html).toContain('图表');
    expect(html).toContain('代码');
    expect(html).toContain('下载');
    expect(html).toContain('全屏');
    expect(html).toContain('100%');
  });
});
