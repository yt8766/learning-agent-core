import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { stateQueue, initializeMock, renderMock, requestFullscreenMock } = vi.hoisted(() => ({
  stateQueue: [] as Array<[unknown, ReturnType<typeof vi.fn>]>,
  initializeMock: vi.fn(),
  renderMock: vi.fn(),
  requestFullscreenMock: vi.fn(async () => undefined)
}));

vi.mock('react', async importOriginal => {
  const actual = await importOriginal<typeof import('react')>();
  return {
    ...actual,
    useState: ((initialValue: unknown) => {
      if (stateQueue.length > 0) {
        return stateQueue.shift()!;
      }
      return [initialValue, vi.fn()];
    }) as unknown as typeof actual.useState,
    useRef: ((initialValue: unknown) => {
      if (initialValue === null) {
        return {
          current: {
            requestFullscreen: requestFullscreenMock,
            scrollLeft: 12,
            scrollTop: 18
          }
        };
      }
      return { current: initialValue };
    }) as unknown as typeof actual.useRef
  };
});

vi.mock('mermaid', () => ({
  default: {
    initialize: initializeMock,
    render: renderMock
  }
}));

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
      'runtime-host -->|research| graph-node-research'
    ].join('\n');

    const sanitized = sanitizeMermaidSource(source);

    expect(sanitized).toContain('subgraph group_frontends [Frontends]');
    expect(sanitized).toContain('node_agent_chat["agent-chat<br/>OpenClaw 前线作战面"]');
    expect(sanitized).toContain('node_graph_node_research["Research Subgraph<br/>hubu-search"]');
    expect(sanitized).toContain('node_runtime_host -->|research| node_graph_node_research');
  });
});

describe('ArchitectureMermaidCard', () => {
  beforeEach(() => {
    stateQueue.length = 0;
    initializeMock.mockReset();
    renderMock.mockReset();
    requestFullscreenMock.mockClear();

    vi.stubGlobal('window', {
      setTimeout: vi.fn(() => 1)
    });
    vi.stubGlobal('document', {
      fullscreenElement: undefined,
      body: {
        appendChild: vi.fn(),
        removeChild: vi.fn()
      },
      createElement: vi.fn(() => ({})),
      exitFullscreen: vi.fn()
    });
  });

  it('renders toolbar shell and mermaid code fallback when svg is unavailable', () => {
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
            nodes: [{ id: 'runtime-host', label: 'runtime-host' }],
            edges: []
          },
          mermaid: 'flowchart LR\nruntime-host["runtime-host"]'
        }
      })
    );

    expect(html).toContain('图表');
    expect(html).toContain('代码');
    expect(html).toContain('下载');
    expect(html).toContain('全屏');
    expect(html).toContain('100%');
    expect(html).toContain('flowchart LR');
  });

  it('renders diagram mode with copied state, zoom label and render error message', () => {
    stateQueue.push(
      ['<svg><g>diagram</g></svg>', vi.fn()],
      ['syntax error', vi.fn()],
      ['diagram', vi.fn()],
      [1.2, vi.fn()],
      [0.8, vi.fn()],
      [true, vi.fn()]
    );

    const html = renderToStaticMarkup(
      <ArchitectureMermaidCard
        diagram={
          {
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
              nodes: [{ id: 'runtime-host', label: 'runtime-host' }],
              edges: []
            },
            mermaid: 'flowchart LR\nruntime-host["runtime-host"]'
          } as any
        }
      />
    );

    expect(html).toContain('96%');
    expect(html).toContain('已复制');
    expect(html).toContain('Mermaid 渲染降级：syntax error');
    expect(html).toContain('<svg><g>diagram</g></svg>');
  });

  it('renders copy, download and fullscreen toolbar affordances in code mode', () => {
    const html = renderToStaticMarkup(
      <ArchitectureMermaidCard
        diagram={
          {
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
              nodes: [{ id: 'runtime-host', label: 'runtime-host' }],
              edges: []
            },
            mermaid: 'flowchart LR\nruntime-host["runtime-host"]'
          } as any
        }
      />
    );

    expect(html).toContain('复制代码');
    expect(html).toContain('下载');
    expect(html).toContain('全屏');
    expect(html).toContain('重置');
  });

  it('renders zoom controls and reset action in diagram mode', () => {
    const setScale = vi.fn();
    stateQueue.push(
      [undefined, vi.fn()],
      ['', vi.fn()],
      ['diagram', vi.fn()],
      [1, setScale],
      [1, vi.fn()],
      [false, vi.fn()]
    );

    const html = renderToStaticMarkup(
      <ArchitectureMermaidCard
        diagram={
          {
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
              nodes: [{ id: 'runtime-host', label: 'runtime-host' }],
              edges: []
            },
            mermaid: 'flowchart LR\nruntime-host["runtime-host"]'
          } as any
        }
      />
    );

    expect(setScale).not.toHaveBeenCalled();
    expect(html).toContain('aria-label="缩小架构图"');
    expect(html).toContain('aria-label="放大架构图"');
    expect(html).toContain('重置');
  });
});
