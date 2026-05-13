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

vi.mock('@/utils/utils', () => ({
  cn: (...args: (string | boolean | undefined)[]) => args.filter(Boolean).join(' ')
}));

import { NodeTimeline } from '@/pages/workflow-lab/components/NodeTimeline';
import type { StreamNodeEvent } from '@/pages/workflow-lab/hooks/useWorkflowStream';

const baseNode: StreamNodeEvent = {
  nodeId: 'step-1',
  status: 'succeeded',
  durationMs: 100,
  inputSnapshot: {},
  outputSnapshot: {},
  receivedAt: '2026-05-01T10:00:00.000Z'
};

describe('NodeTimeline', () => {
  it('renders placeholder when nodes is empty and runStatus is idle', () => {
    const html = renderToStaticMarkup(
      <NodeTimeline nodes={[]} runStatus="idle" onSelectNode={vi.fn()} selectedNodeId={null} />
    );

    expect(html).toContain('填写参数后点击运行开始');
  });

  it('does not render placeholder when nodes is empty but status is not idle', () => {
    const html = renderToStaticMarkup(
      <NodeTimeline nodes={[]} runStatus="running" onSelectNode={vi.fn()} selectedNodeId={null} />
    );

    expect(html).not.toContain('填写参数后点击运行开始');
    expect(html).toContain('等待下一个节点');
  });

  it('renders node items with node id and duration', () => {
    const nodes: StreamNodeEvent[] = [
      { ...baseNode, nodeId: 'generate', durationMs: 250, status: 'succeeded' },
      { ...baseNode, nodeId: 'validate', durationMs: 50, status: 'failed' }
    ];

    const html = renderToStaticMarkup(
      <NodeTimeline nodes={nodes} runStatus="completed" onSelectNode={vi.fn()} selectedNodeId={null} />
    );

    expect(html).toContain('generate');
    expect(html).toContain('250ms');
    expect(html).toContain('validate');
    expect(html).toContain('50ms');
  });

  it('renders correct status labels', () => {
    const nodes: StreamNodeEvent[] = [
      { ...baseNode, nodeId: 'a', status: 'succeeded', durationMs: 10 },
      { ...baseNode, nodeId: 'b', status: 'failed', durationMs: 20 },
      { ...baseNode, nodeId: 'c', status: 'skipped', durationMs: 0 }
    ];

    const html = renderToStaticMarkup(
      <NodeTimeline nodes={nodes} runStatus="completed" onSelectNode={vi.fn()} selectedNodeId={null} />
    );

    expect(html).toContain('成功');
    expect(html).toContain('失败');
    expect(html).toContain('跳过');
  });

  it('applies ring styling to selected node', () => {
    const nodes: StreamNodeEvent[] = [{ ...baseNode, nodeId: 'selected-node', status: 'succeeded', durationMs: 10 }];

    const html = renderToStaticMarkup(
      <NodeTimeline nodes={nodes} runStatus="completed" onSelectNode={vi.fn()} selectedNodeId="selected-node" />
    );

    expect(html).toContain('ring-2');
  });

  it('renders waiting indicator when runStatus is running', () => {
    const html = renderToStaticMarkup(
      <NodeTimeline nodes={[]} runStatus="running" onSelectNode={vi.fn()} selectedNodeId={null} />
    );

    expect(html).toContain('等待下一个节点');
  });

  it('does not render waiting indicator when runStatus is not running', () => {
    const html = renderToStaticMarkup(
      <NodeTimeline nodes={[]} runStatus="completed" onSelectNode={vi.fn()} selectedNodeId={null} />
    );

    expect(html).not.toContain('等待下一个节点');
  });

  it('renders separator between nodes but not after the last one', () => {
    const nodes: StreamNodeEvent[] = [
      { ...baseNode, nodeId: 'a', status: 'succeeded', durationMs: 10 },
      { ...baseNode, nodeId: 'b', status: 'succeeded', durationMs: 20 }
    ];

    const html = renderToStaticMarkup(
      <NodeTimeline nodes={nodes} runStatus="completed" onSelectNode={vi.fn()} selectedNodeId={null} />
    );

    // Should have exactly one separator (between a and b)
    const separatorCount = (html.match(/h-4 w-px bg-border/g) || []).length;
    expect(separatorCount).toBe(1);
  });
});
