import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { AgentOsStepItem } from '@/components/chat-response-steps/agent-os-step-item';

describe('AgentOsStepItem', () => {
  it('renders step with queued status', () => {
    const html = renderToStaticMarkup(
      <AgentOsStepItem
        step={
          {
            id: 'step-1',
            title: 'Compiling',
            status: 'queued',

            sessionId: 's1'
          } as any
        }
      />
    );

    expect(html).toContain('等待中');
    expect(html).toContain('Compiling');
    expect(html).toContain('is-queued');
  });

  it('renders step with running status', () => {
    const html = renderToStaticMarkup(
      <AgentOsStepItem
        step={
          {
            id: 'step-2',
            title: 'Running tests',
            status: 'running',

            sessionId: 's1'
          } as any
        }
      />
    );

    expect(html).toContain('处理中');
    expect(html).toContain('Running tests');
    expect(html).toContain('is-running');
  });

  it('renders step with completed status', () => {
    const html = renderToStaticMarkup(
      <AgentOsStepItem
        step={
          {
            id: 'step-3',
            title: 'Build finished',
            status: 'completed',

            sessionId: 's1'
          } as any
        }
      />
    );

    expect(html).toContain('已完成');
    expect(html).toContain('Build finished');
    expect(html).toContain('is-completed');
  });

  it('renders step with blocked status', () => {
    const html = renderToStaticMarkup(
      <AgentOsStepItem
        step={
          {
            id: 'step-4',
            title: 'Needs approval',
            status: 'blocked',

            sessionId: 's1'
          } as any
        }
      />
    );

    expect(html).toContain('已阻断');
    expect(html).toContain('is-blocked');
  });

  it('renders step with failed status', () => {
    const html = renderToStaticMarkup(
      <AgentOsStepItem
        step={
          {
            id: 'step-5',
            title: 'Test failed',
            status: 'failed',

            sessionId: 's1'
          } as any
        }
      />
    );

    expect(html).toContain('失败');
    expect(html).toContain('is-failed');
  });

  it('renders step with cancelled status', () => {
    const html = renderToStaticMarkup(
      <AgentOsStepItem
        step={
          {
            id: 'step-6',
            title: 'Cancelled',
            status: 'cancelled',

            sessionId: 's1'
          } as any
        }
      />
    );

    expect(html).toContain('已取消');
    expect(html).toContain('is-cancelled');
  });

  it('renders detail when provided', () => {
    const html = renderToStaticMarkup(
      <AgentOsStepItem
        step={
          {
            id: 'step-7',
            title: 'Compiling',
            detail: 'Building 3 files',
            status: 'running',

            sessionId: 's1'
          } as any
        }
      />
    );

    expect(html).toContain('Building 3 files');
  });

  it('does not render detail when not provided', () => {
    const html = renderToStaticMarkup(
      <AgentOsStepItem
        step={
          {
            id: 'step-8',
            title: 'Compiling',
            status: 'running',

            sessionId: 's1'
          } as any
        }
      />
    );

    expect(html).not.toContain('chat-response-steps__agent-os-step-detail');
  });

  it('renders file target with path', () => {
    const html = renderToStaticMarkup(
      <AgentOsStepItem
        step={
          {
            id: 'step-9',
            title: 'Editing file',
            status: 'running',

            sessionId: 's1',
            target: { kind: 'file', path: '/src/index.ts', label: 'index.ts' }
          } as any
        }
      />
    );

    expect(html).toContain('/src/index.ts');
  });

  it('renders file target with label fallback when path is empty', () => {
    const html = renderToStaticMarkup(
      <AgentOsStepItem
        step={
          {
            id: 'step-10',
            title: 'Editing file',
            status: 'running',

            sessionId: 's1',
            target: { kind: 'file', path: '', label: 'index.ts' }
          } as any
        }
      />
    );

    expect(html).toContain('index.ts');
  });

  it('renders command target with label', () => {
    const html = renderToStaticMarkup(
      <AgentOsStepItem
        step={
          {
            id: 'step-11',
            title: 'Running command',
            status: 'running',

            sessionId: 's1',
            target: { kind: 'command', label: 'npm test' }
          } as any
        }
      />
    );

    expect(html).toContain('npm test');
  });

  it('renders test target with label', () => {
    const html = renderToStaticMarkup(
      <AgentOsStepItem
        step={
          {
            id: 'step-12',
            title: 'Running tests',
            status: 'running',

            sessionId: 's1',
            target: { kind: 'test', label: 'unit tests' }
          } as any
        }
      />
    );

    expect(html).toContain('unit tests');
  });

  it('does not render target label for unknown target kind', () => {
    const html = renderToStaticMarkup(
      <AgentOsStepItem
        step={
          {
            id: 'step-13',
            title: 'Unknown target',
            status: 'running',

            sessionId: 's1',
            target: { kind: 'unknown', label: 'something' } as any
          } as any
        }
      />
    );

    expect(html).not.toContain('chat-response-steps__agent-os-target');
  });

  it('does not render target code when target is undefined', () => {
    const html = renderToStaticMarkup(
      <AgentOsStepItem
        step={
          {
            id: 'step-14',
            title: 'No target',
            status: 'running',

            sessionId: 's1'
          } as any
        }
      />
    );

    expect(html).not.toContain('chat-response-steps__agent-os-target');
  });
});
