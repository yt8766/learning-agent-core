import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('lucide-react', () => ({
  CheckCircle: () => <span>CheckCircle</span>,
  Circle: () => <span>Circle</span>,
  Clock: () => <span>Clock</span>,
  XCircle: () => <span>XCircle</span>
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, variant }: { children: React.ReactNode; variant?: string }) => (
    <span className="badge" data-variant={variant ?? ''}>
      {children}
    </span>
  )
}));

vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children }: { children: React.ReactNode }) => <div className="scroll-area">{children}</div>
}));

import { NodeDetailPanel } from '@/pages/workflow-lab/components/NodeDetailPanel';

describe('NodeDetailPanel', () => {
  it('renders placeholder when node is null', () => {
    const html = renderToStaticMarkup(<NodeDetailPanel node={null} />);

    expect(html).toContain('点击中栏节点');
    expect(html).toContain('查看输入/输出详情');
  });

  it('renders node details for a succeeded node', () => {
    const html = renderToStaticMarkup(
      <NodeDetailPanel
        node={{
          nodeId: 'generate-1',
          status: 'succeeded',
          durationMs: 120,
          inputSnapshot: { prompt: 'hello' },
          outputSnapshot: { result: 'world' },
          receivedAt: '2026-05-01T10:00:00.000Z'
        }}
      />
    );

    expect(html).toContain('generate-1');
    expect(html).toContain('成功');
    expect(html).toContain('120ms');
    expect(html).toContain('&quot;prompt&quot;: &quot;hello&quot;');
    expect(html).toContain('&quot;result&quot;: &quot;world&quot;');
  });

  it('renders node details for a failed node with error message', () => {
    const html = renderToStaticMarkup(
      <NodeDetailPanel
        node={{
          nodeId: 'validate-1',
          status: 'failed',
          durationMs: 45,
          inputSnapshot: {},
          outputSnapshot: {},
          errorMessage: 'Validation failed: missing required field',
          receivedAt: '2026-05-01T10:00:01.000Z'
        }}
      />
    );

    expect(html).toContain('validate-1');
    expect(html).toContain('失败');
    expect(html).toContain('45ms');
    expect(html).toContain('Validation failed: missing required field');
    expect(html).toContain('错误信息');
  });

  it('renders node details for a skipped node', () => {
    const html = renderToStaticMarkup(
      <NodeDetailPanel
        node={{
          nodeId: 'optional-step',
          status: 'skipped',
          durationMs: 0,
          inputSnapshot: {},
          outputSnapshot: {},
          receivedAt: '2026-05-01T10:00:02.000Z'
        }}
      />
    );

    expect(html).toContain('optional-step');
    expect(html).toContain('跳过');
  });

  it('does not render error section when errorMessage is absent', () => {
    const html = renderToStaticMarkup(
      <NodeDetailPanel
        node={{
          nodeId: 'step-1',
          status: 'succeeded',
          durationMs: 10,
          inputSnapshot: {},
          outputSnapshot: {},
          receivedAt: '2026-05-01T10:00:00.000Z'
        }}
      />
    );

    expect(html).not.toContain('错误信息');
  });

  it('renders input and output JSON blocks', () => {
    const html = renderToStaticMarkup(
      <NodeDetailPanel
        node={{
          nodeId: 'json-node',
          status: 'succeeded',
          durationMs: 5,
          inputSnapshot: { key: 'value', nested: { a: 1 } },
          outputSnapshot: { status: 'ok' },
          receivedAt: '2026-05-01T10:00:00.000Z'
        }}
      />
    );

    expect(html).toContain('输入');
    expect(html).toContain('输出');
    expect(html).toContain('&quot;key&quot;: &quot;value&quot;');
    expect(html).toContain('&quot;status&quot;: &quot;ok&quot;');
  });
});
