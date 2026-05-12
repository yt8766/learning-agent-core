import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('lucide-react', () => ({
  Play: () => null
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, type, disabled }: any) => (
    <button type={type ?? 'button'} disabled={disabled}>
      {children}
    </button>
  )
}));

vi.mock('@/components/ui/input', () => ({
  Input: (props: any) => <input {...props} />
}));

import { WorkflowRunForm } from '@/pages/workflow-lab/components/WorkflowRunForm';
import type { WorkflowDefinition } from '@/pages/workflow-lab/registry/workflow.registry';

const workflowWithFields: WorkflowDefinition = {
  id: 'wf-form',
  name: 'Form Workflow',
  description: 'Workflow with form fields',
  fields: [
    { name: 'prompt', label: 'Prompt', type: 'text', required: true, placeholder: 'Enter prompt' },
    { name: 'maxTokens', label: 'Max Tokens', type: 'number', defaultValue: 100 },
    {
      name: 'mode',
      label: 'Mode',
      type: 'select',
      options: [
        { value: 'fast', label: 'Fast' },
        { value: 'thorough', label: 'Thorough' }
      ]
    }
  ],
  graph: { nodes: [], edges: [] },
  mapFormToPayload: values => values
};

const emptyWorkflow: WorkflowDefinition = {
  id: 'wf-empty',
  name: 'Empty Workflow',
  description: 'No fields',
  fields: [],
  graph: { nodes: [], edges: [] },
  mapFormToPayload: values => values
};

describe('WorkflowRunForm', () => {
  it('renders the form header with field count', () => {
    const html = renderToStaticMarkup(
      <WorkflowRunForm workflow={workflowWithFields} onSubmit={vi.fn()} isRunning={false} />
    );

    expect(html).toContain('运行参数');
    expect(html).toContain('3 fields');
  });

  it('renders text input field', () => {
    const html = renderToStaticMarkup(
      <WorkflowRunForm workflow={workflowWithFields} onSubmit={vi.fn()} isRunning={false} />
    );

    expect(html).toContain('Prompt');
    expect(html).toContain('workflow-run-wf-form-prompt');
    expect(html).toContain('Enter prompt');
  });

  it('renders number input field', () => {
    const html = renderToStaticMarkup(
      <WorkflowRunForm workflow={workflowWithFields} onSubmit={vi.fn()} isRunning={false} />
    );

    expect(html).toContain('Max Tokens');
    expect(html).toContain('workflow-run-wf-form-maxTokens');
  });

  it('renders select field with options', () => {
    const html = renderToStaticMarkup(
      <WorkflowRunForm workflow={workflowWithFields} onSubmit={vi.fn()} isRunning={false} />
    );

    expect(html).toContain('Mode');
    expect(html).toContain('Fast');
    expect(html).toContain('Thorough');
  });

  it('renders required indicator for required fields', () => {
    const html = renderToStaticMarkup(
      <WorkflowRunForm workflow={workflowWithFields} onSubmit={vi.fn()} isRunning={false} />
    );

    expect(html).toContain('text-destructive');
  });

  it('renders run button text when not running', () => {
    const html = renderToStaticMarkup(
      <WorkflowRunForm workflow={workflowWithFields} onSubmit={vi.fn()} isRunning={false} />
    );

    expect(html).toContain('运行工作流');
  });

  it('renders running button text when running', () => {
    const html = renderToStaticMarkup(
      <WorkflowRunForm workflow={workflowWithFields} onSubmit={vi.fn()} isRunning={true} />
    );

    expect(html).toContain('运行中');
  });

  it('renders empty form when workflow has no fields', () => {
    const html = renderToStaticMarkup(
      <WorkflowRunForm workflow={emptyWorkflow} onSubmit={vi.fn()} isRunning={false} />
    );

    expect(html).toContain('0 fields');
    expect(html).toContain('运行工作流');
  });

  it('renders field labels', () => {
    const html = renderToStaticMarkup(
      <WorkflowRunForm workflow={workflowWithFields} onSubmit={vi.fn()} isRunning={false} />
    );

    expect(html).toContain('Prompt');
    expect(html).toContain('Max Tokens');
    expect(html).toContain('Mode');
  });
});
