import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/pages/workflow-lab/api/workflow-runs.api', () => ({
  listWorkflowRuns: vi.fn().mockResolvedValue([]),
  startWorkflowRun: vi.fn().mockResolvedValue({ runId: 'run-1' })
}));

vi.mock('@/pages/workflow-lab/hooks/useWorkflowStream', () => ({
  useWorkflowStream: vi.fn(() => ({ nodes: [], runStatus: 'idle' }))
}));

vi.mock('@/pages/workflow-lab/components/NodeDetailPanel', () => ({
  NodeDetailPanel: () => '<div>NodeDetailPanel</div>'
}));

vi.mock('@/pages/workflow-lab/components/NodeTimelinePanel', () => ({
  NodeTimelinePanel: () => '<div>NodeTimelinePanel</div>'
}));

vi.mock('@/pages/workflow-lab/components/WorkflowSidebar', () => ({
  WorkflowSidebar: () => '<div>WorkflowSidebar</div>'
}));

vi.mock('@/pages/workflow-lab/registry/workflow.registry', () => ({
  workflowRegistry: [
    {
      id: 'wf-1',
      name: 'Workflow 1',
      description: 'First workflow',
      fields: [],
      mapFormToPayload: (v: any) => v
    }
  ]
}));

import { WorkflowLabPage } from '@/pages/workflow-lab/WorkflowLabPage';

describe('WorkflowLabPage', () => {
  it('renders the page layout with sidebar, main area, and detail panel', () => {
    const html = renderToStaticMarkup(<WorkflowLabPage />);

    expect(html).toContain('WorkflowSidebar');
    expect(html).toContain('NodeTimelinePanel');
    expect(html).toContain('NodeDetailPanel');
  });

  it('renders the layout container', () => {
    const html = renderToStaticMarkup(<WorkflowLabPage />);

    expect(html).toContain('flex');
    expect(html).toContain('overflow-hidden');
  });

  it('renders sidebar width', () => {
    const html = renderToStaticMarkup(<WorkflowLabPage />);

    expect(html).toContain('w-[260px]');
  });

  it('renders detail panel width', () => {
    const html = renderToStaticMarkup(<WorkflowLabPage />);

    expect(html).toContain('w-[360px]');
  });
});
