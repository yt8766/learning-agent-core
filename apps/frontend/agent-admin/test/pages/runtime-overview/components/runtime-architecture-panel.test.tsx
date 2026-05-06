import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const runtimeArchitectureTestState = vi.hoisted(() => ({
  stateQueue: [] as Array<[unknown, ReturnType<typeof vi.fn>]>,
  runEffectsImmediately: false,
  getRuntimeArchitectureMock: vi.fn()
}));

vi.mock('react', async importOriginal => {
  const actual = await importOriginal<typeof import('react')>();
  return {
    ...actual,
    useEffect: ((effect: () => void | (() => void)) => {
      if (runtimeArchitectureTestState.runEffectsImmediately) {
        effect();
      }
    }) as typeof actual.useEffect,
    useState: ((initialValue: unknown) => {
      if (runtimeArchitectureTestState.stateQueue.length > 0) {
        return runtimeArchitectureTestState.stateQueue.shift()!;
      }
      return [initialValue, vi.fn()];
    }) as unknown as typeof actual.useState
  };
});

vi.mock('@/api/admin-api', () => ({
  getRuntimeArchitecture: runtimeArchitectureTestState.getRuntimeArchitectureMock,
  isAbortedAdminRequestError: () => false
}));

vi.mock('@/pages/runtime-overview/components/architecture-mermaid-card', () => ({
  ArchitectureMermaidCard: ({ diagram }: { diagram: { title: string } }) => <div>diagram:{diagram.title}</div>
}));

import { RuntimeArchitecturePanel } from '@/pages/runtime-overview/components/runtime-architecture-panel';

describe('RuntimeArchitecturePanel', () => {
  beforeEach(() => {
    runtimeArchitectureTestState.stateQueue.length = 0;
    runtimeArchitectureTestState.getRuntimeArchitectureMock.mockReset();
    runtimeArchitectureTestState.runEffectsImmediately = false;
  });

  it('renders active diagram summary when record state is already available', () => {
    runtimeArchitectureTestState.stateQueue.push(
      [
        {
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
              nodes: [{ id: 'runtime-host', label: 'runtime-host' }],
              edges: []
            },
            mermaid: 'flowchart LR\nruntime_host["runtime-host"]'
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
        },
        vi.fn()
      ],
      ['agentChat', vi.fn()],
      [false, vi.fn()],
      ['', vi.fn()]
    );

    const html = renderToStaticMarkup(<RuntimeArchitecturePanel />);

    expect(html).toContain('Architecture View');
    expect(html).toContain('重新生成');
    expect(html).toContain('agent-chat 架构图');
    expect(html).toContain('1 nodes / 0 routes');
    expect(html).toContain('chat workspace descriptor');
    expect(html).toContain('diagram:agent-chat 架构图');
  });

  it('requests architecture data on mount', () => {
    runtimeArchitectureTestState.runEffectsImmediately = true;
    runtimeArchitectureTestState.getRuntimeArchitectureMock.mockResolvedValue({
      project: null,
      agent: null,
      agentChat: null,
      agentAdmin: null
    });

    renderToStaticMarkup(<RuntimeArchitecturePanel />);

    expect(runtimeArchitectureTestState.getRuntimeArchitectureMock).toHaveBeenCalledTimes(1);
  });
});
