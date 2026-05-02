import { CheckCircle, Circle, Clock, XCircle } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

import type { RunStatus, StreamNodeEvent } from '../hooks/useWorkflowStream';

interface NodeTimelineProps {
  nodes: StreamNodeEvent[];
  runStatus: RunStatus;
  onSelectNode: (node: StreamNodeEvent) => void;
  selectedNodeId: string | null;
}

function NodeStatusIcon({ status }: { status: StreamNodeEvent['status'] | 'running' }) {
  if (status === 'succeeded') {
    return <CheckCircle className="h-4 w-4 text-emerald-600" />;
  }
  if (status === 'failed') {
    return <XCircle className="h-4 w-4 text-destructive" />;
  }
  if (status === 'running') {
    return <Clock className="h-4 w-4 animate-spin text-sky-600" />;
  }
  return <Circle className="h-4 w-4 text-muted-foreground" />;
}

function nodeTone(status: StreamNodeEvent['status']) {
  if (status === 'succeeded') {
    return 'border-emerald-200/70 bg-emerald-50/70';
  }
  if (status === 'failed') {
    return 'border-destructive/30 bg-destructive/5';
  }
  return 'border-border/70 bg-muted/30';
}

function statusLabel(status: StreamNodeEvent['status']) {
  if (status === 'succeeded') {
    return '成功';
  }
  if (status === 'failed') {
    return '失败';
  }
  return '跳过';
}

export function NodeTimeline({ nodes, runStatus, onSelectNode, selectedNodeId }: NodeTimelineProps) {
  if (nodes.length === 0 && runStatus === 'idle') {
    return (
      <div className="flex h-40 items-center justify-center rounded-2xl border border-dashed border-border/70 bg-muted/20 px-4 text-center text-sm text-muted-foreground">
        填写参数后点击运行开始。
      </div>
    );
  }

  return (
    <div className="grid gap-2 py-2">
      {nodes.map((node, index) => (
        <div key={`${node.nodeId}-${node.receivedAt}-${index}`} className="grid gap-0">
          <button
            type="button"
            onClick={() => onSelectNode(node)}
            className={cn(
              'flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left text-sm transition-colors',
              nodeTone(node.status),
              selectedNodeId === node.nodeId ? 'ring-2 ring-ring/40' : 'hover:bg-muted/50'
            )}
          >
            <NodeStatusIcon status={node.status} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-foreground">{node.nodeId}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{node.durationMs}ms</p>
            </div>
            <Badge
              variant={node.status === 'failed' ? 'destructive' : node.status === 'succeeded' ? 'success' : 'outline'}
            >
              {statusLabel(node.status)}
            </Badge>
          </button>
          {index < nodes.length - 1 ? <div className="mx-auto h-4 w-px bg-border" /> : null}
        </div>
      ))}

      {runStatus === 'running' ? (
        <div className="flex items-center gap-3 rounded-2xl border border-dashed border-border/70 bg-background px-4 py-3 text-sm text-muted-foreground">
          <NodeStatusIcon status="running" />
          <span>等待下一个节点...</span>
        </div>
      ) : null}
    </div>
  );
}
