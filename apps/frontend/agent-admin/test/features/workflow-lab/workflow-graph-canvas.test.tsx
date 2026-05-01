import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { WorkflowGraphCanvas } from '../../../src/features/workflow-lab/components/WorkflowGraphCanvas';
import type { WorkflowDefinition } from '../../../src/features/workflow-lab/registry/workflow.registry';

const workflow: WorkflowDefinition = {
  id: 'demo-workflow',
  name: 'Demo Workflow',
  description: 'Graph test workflow',
  fields: [],
  graph: {
    nodes: [
      { id: 'start', label: 'Start', ministry: 'hubu-research' },
      { id: 'generate', label: 'Generate', ministry: 'gongbu-code' },
      { id: 'validate', label: 'Validate', ministry: 'xingbu-review' }
    ],
    edges: [
      { from: 'start', to: 'generate' },
      { from: 'generate', to: 'validate' }
    ]
  },
  mapFormToPayload: values => values
};

describe('WorkflowGraphCanvas', () => {
  it('renders a path-based graph debugger with node status, edges, and selectable graph nodes', () => {
    const html = renderToStaticMarkup(
      <WorkflowGraphCanvas
        workflow={workflow}
        runStatus="running"
        nodes={[
          {
            nodeId: 'start',
            status: 'succeeded',
            durationMs: 12,
            inputSnapshot: {},
            outputSnapshot: {},
            receivedAt: '2026-04-30T12:00:00.000Z'
          },
          {
            nodeId: 'generate',
            status: 'failed',
            durationMs: 34,
            inputSnapshot: {},
            outputSnapshot: {},
            errorMessage: 'boom',
            receivedAt: '2026-04-30T12:00:01.000Z'
          }
        ]}
        selectedNodeId="generate"
        onSelectNode={vi.fn()}
      />
    );

    expect(html).toContain('data-workflow-graph-canvas="true"');
    expect(html).toContain('Graph');
    expect(html).toContain('Start');
    expect(html).toContain('Generate');
    expect(html).toContain('Validate');
    expect(html).toContain('start → generate');
    expect(html).toContain('generate → validate');
    expect(html).toContain('data-node-status="succeeded"');
    expect(html).toContain('data-node-status="failed"');
    expect(html).toContain('data-selected="true"');
  });
});
