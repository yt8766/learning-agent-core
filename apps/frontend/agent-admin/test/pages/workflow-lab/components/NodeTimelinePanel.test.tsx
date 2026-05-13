import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, variant }: { children: React.ReactNode; variant?: string }) =>
    `<span class="badge" data-variant="${variant ?? ''}">${children}</span>`
}));

vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children }: { children: React.ReactNode }) => `<div class="scroll-area">${children}</div>`
}));

vi.mock('@/pages/workflow-lab/components/NodeTimeline', () => ({
  NodeTimeline: () => '<div>NodeTimeline</div>'
}));

vi.mock('@/pages/workflow-lab/components/WorkflowGraphCanvas', () => ({
  WorkflowGraphCanvas: () => '<div>WorkflowGraphCanvas</div>'
}));

vi.mock('@/pages/workflow-lab/components/WorkflowRunForm', () => ({
  WorkflowRunForm: () => '<div>WorkflowRunForm</div>'
}));

import { NodeTimelinePanel } from '@/pages/workflow-lab/components/NodeTimelinePanel';
import type { WorkflowDefinition } from '@/pages/workflow-lab/registry/workflow.registry';

const workflow: WorkflowDefinition = {
  id: 'test-workflow',
  name: 'Test Workflow',
  description: 'A test workflow',
  fields: [],
  graph: { nodes: [], edges: [] },
  mapFormToPayload: values => values
};

describe('NodeTimelinePanel', () => {
  it('renders placeholder when no workflow is selected', () => {
    const html = renderToStaticMarkup(
      <NodeTimelinePanel
        selectedWorkflow={null}
        nodes={[]}
        runStatus="idle"
        activeRunId={null}
        selectedNodeId={null}
        onStartRun={vi.fn()}
        onSelectNode={vi.fn()}
      />
    );

    expect(html).toContain('请从左侧选择一个工作流');
  });

  it('renders workflow name and description when workflow is selected', () => {
    const html = renderToStaticMarkup(
      <NodeTimelinePanel
        selectedWorkflow={workflow}
        nodes={[]}
        runStatus="idle"
        activeRunId={null}
        selectedNodeId={null}
        onStartRun={vi.fn()}
        onSelectNode={vi.fn()}
      />
    );

    expect(html).toContain('Test Workflow');
    expect(html).toContain('A test workflow');
  });

  it('renders idle run status badge', () => {
    const html = renderToStaticMarkup(
      <NodeTimelinePanel
        selectedWorkflow={workflow}
        nodes={[]}
        runStatus="idle"
        activeRunId={null}
        selectedNodeId={null}
        onStartRun={vi.fn()}
        onSelectNode={vi.fn()}
      />
    );

    expect(html).toContain('idle');
  });

  it('renders running run status badge', () => {
    const html = renderToStaticMarkup(
      <NodeTimelinePanel
        selectedWorkflow={workflow}
        nodes={[]}
        runStatus="running"
        activeRunId="run-12345678"
        selectedNodeId={null}
        onStartRun={vi.fn()}
        onSelectNode={vi.fn()}
      />
    );

    expect(html).toContain('running');
    expect(html).toContain('run-1234');
  });

  it('renders completed run status badge', () => {
    const html = renderToStaticMarkup(
      <NodeTimelinePanel
        selectedWorkflow={workflow}
        nodes={[]}
        runStatus="completed"
        activeRunId={null}
        selectedNodeId={null}
        onStartRun={vi.fn()}
        onSelectNode={vi.fn()}
      />
    );

    expect(html).toContain('completed');
  });

  it('renders failed run status badge', () => {
    const html = renderToStaticMarkup(
      <NodeTimelinePanel
        selectedWorkflow={workflow}
        nodes={[]}
        runStatus="failed"
        activeRunId={null}
        selectedNodeId={null}
        onStartRun={vi.fn()}
        onSelectNode={vi.fn()}
      />
    );

    expect(html).toContain('failed');
  });

  it('does not render activeRunId when null', () => {
    const html = renderToStaticMarkup(
      <NodeTimelinePanel
        selectedWorkflow={workflow}
        nodes={[]}
        runStatus="idle"
        activeRunId={null}
        selectedNodeId={null}
        onStartRun={vi.fn()}
        onSelectNode={vi.fn()}
      />
    );

    expect(html).not.toContain('font-mono');
  });
});
