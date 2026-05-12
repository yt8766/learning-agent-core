import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('lucide-react', () => ({
  Play: () => 'Play'
}));

vi.mock('@/utils/utils', () => ({
  cn: (...args: (string | boolean | undefined)[]) => args.filter(Boolean).join(' ')
}));

import { WorkflowList } from '@/pages/workflow-lab/components/WorkflowList';
import type { WorkflowDefinition } from '@/pages/workflow-lab/registry/workflow.registry';

const workflows: WorkflowDefinition[] = [
  {
    id: 'wf-research',
    name: 'Research Workflow',
    description: 'A workflow for research tasks',
    fields: [],
    graph: { nodes: [], edges: [] },
    mapFormToPayload: values => values
  },
  {
    id: 'wf-deploy',
    name: 'Deploy Workflow',
    description: 'A workflow for deployment tasks',
    fields: [],
    graph: { nodes: [], edges: [] },
    mapFormToPayload: values => values
  }
];

describe('WorkflowList', () => {
  it('renders the section header', () => {
    const html = renderToStaticMarkup(<WorkflowList workflows={[]} selectedId={null} onSelect={vi.fn()} />);

    expect(html).toContain('工作流');
  });

  it('renders workflow items with name, id, and description', () => {
    const html = renderToStaticMarkup(<WorkflowList workflows={workflows} selectedId={null} onSelect={vi.fn()} />);

    expect(html).toContain('Research Workflow');
    expect(html).toContain('wf-research');
    expect(html).toContain('A workflow for research tasks');
    expect(html).toContain('Deploy Workflow');
    expect(html).toContain('wf-deploy');
  });

  it('applies selected styling to the selected workflow', () => {
    const html = renderToStaticMarkup(
      <WorkflowList workflows={workflows} selectedId="wf-research" onSelect={vi.fn()} />
    );

    expect(html).toContain('border-emerald-500');
  });

  it('renders empty list when no workflows', () => {
    const html = renderToStaticMarkup(<WorkflowList workflows={[]} selectedId={null} onSelect={vi.fn()} />);

    expect(html).not.toContain('border-emerald-500');
  });

  it('renders all workflow items', () => {
    const html = renderToStaticMarkup(<WorkflowList workflows={workflows} selectedId={null} onSelect={vi.fn()} />);

    // Should have at least 2 workflow buttons
    expect(html).toContain('Research Workflow');
    expect(html).toContain('Deploy Workflow');
  });
});
