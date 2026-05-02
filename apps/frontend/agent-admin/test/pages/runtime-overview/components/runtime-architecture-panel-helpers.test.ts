import { describe, expect, it } from 'vitest';

import {
  DIAGRAM_ORDER,
  getArchitectureDiagramSummary,
  resolveActiveArchitectureDiagram
} from '@/pages/runtime-overview/components/runtime-architecture-panel-helpers';

describe('runtime-architecture-panel-helpers', () => {
  it('defines the expected diagram order', () => {
    expect(DIAGRAM_ORDER.map(item => item.key)).toEqual(['project', 'agent', 'agentChat', 'agentAdmin']);
  });

  it('resolves active diagrams and summary copy', () => {
    const record = {
      project: {
        id: 'project',
        title: '当前项目架构图',
        sourceDescriptors: ['registry'],
        version: 'v1',
        generatedAt: '2026-04-01T00:00:00.000Z',
        mermaid: 'flowchart LR',
        descriptor: {
          id: 'project',
          title: '当前项目架构图',
          scope: 'project',
          direction: 'LR',
          sourceDescriptors: ['registry'],
          subgraphs: [],
          nodes: [
            { id: 'node-1', label: 'Node 1' },
            { id: 'node-2', label: 'Node 2' }
          ],
          edges: [{ from: 'node-1', to: 'node-2' }]
        }
      },
      agent: null,
      agentChat: null,
      agentAdmin: null
    } as any;

    expect(resolveActiveArchitectureDiagram(null, 'project')).toBeNull();
    const active = resolveActiveArchitectureDiagram(record, 'project');
    expect(active?.id).toBe('project');
    expect(getArchitectureDiagramSummary(active!)).toBe('2 nodes / 1 routes');
  });
});
