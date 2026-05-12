import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { ResponseStepDetail } from '@/components/chat-response-steps/response-step-detail';

describe('ResponseStepDetail', () => {
  it('renders step title and status class', () => {
    const html = renderToStaticMarkup(
      <ResponseStepDetail
        step={
          {
            title: 'Searching documents',
            status: 'running',
            nodeId: 'n1',
            nodeLabel: 'search'
          } as any
        }
      />
    );

    expect(html).toContain('Searching documents');
    expect(html).toContain('is-running');
    expect(html).toContain('search');
  });

  it('renders owner label from agentScope sub', () => {
    const html = renderToStaticMarkup(
      <ResponseStepDetail
        step={
          {
            title: 'Step',
            status: 'completed',
            agentScope: 'sub'
          } as any
        }
      />
    );

    expect(html).toContain('子 Agent');
  });

  it('renders owner label from agentScope system', () => {
    const html = renderToStaticMarkup(
      <ResponseStepDetail
        step={
          {
            title: 'Step',
            status: 'completed',
            agentScope: 'system'
          } as any
        }
      />
    );

    expect(html).toContain('系统');
  });

  it('renders owner label from agentScope main', () => {
    const html = renderToStaticMarkup(
      <ResponseStepDetail
        step={
          {
            title: 'Step',
            status: 'completed',
            agentScope: 'main'
          } as any
        }
      />
    );

    expect(html).toContain('主 Agent');
  });

  it('prefers ownerLabel over agentScope', () => {
    const html = renderToStaticMarkup(
      <ResponseStepDetail
        step={
          {
            title: 'Step',
            status: 'completed',
            agentScope: 'sub',
            ownerLabel: 'Custom Owner'
          } as any
        }
      />
    );

    expect(html).toContain('Custom Owner');
    expect(html).not.toContain('子 Agent');
  });

  it('renders agent label when provided', () => {
    const html = renderToStaticMarkup(
      <ResponseStepDetail
        step={
          {
            title: 'Step',
            status: 'completed',
            agentLabel: 'coder'
          } as any
        }
      />
    );

    expect(html).toContain('coder');
  });

  it('renders detail text when provided', () => {
    const html = renderToStaticMarkup(
      <ResponseStepDetail
        step={
          {
            title: 'Step',
            status: 'completed',
            detail: 'Additional detail info'
          } as any
        }
      />
    );

    expect(html).toContain('Additional detail info');
  });

  it('renders node transition when fromNodeId and toNodeId are provided', () => {
    const html = renderToStaticMarkup(
      <ResponseStepDetail
        step={
          {
            title: 'Step',
            status: 'completed',
            fromNodeId: 'node-a',
            toNodeId: 'node-b'
          } as any
        }
      />
    );

    expect(html).toContain('node-a');
    expect(html).toContain('node-b');
  });

  it('uses nodeId as fromNodeId fallback', () => {
    const html = renderToStaticMarkup(
      <ResponseStepDetail
        step={
          {
            title: 'Step',
            status: 'completed',
            nodeId: 'n1',
            toNodeId: 'n2'
          } as any
        }
      />
    );

    expect(html).toContain('n1');
    expect(html).toContain('n2');
  });

  it('does not render transition when no node IDs', () => {
    const html = renderToStaticMarkup(
      <ResponseStepDetail
        step={
          {
            title: 'Step',
            status: 'completed'
          } as any
        }
      />
    );

    expect(html).not.toContain('节点：');
  });
});
