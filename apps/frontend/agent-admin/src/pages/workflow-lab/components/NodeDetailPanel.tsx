import { CheckCircle, Circle, Clock, XCircle } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

import type { StreamNodeEvent } from '../hooks/useWorkflowStream';

interface NodeDetailPanelProps {
  node: StreamNodeEvent | null;
}

function JsonBlock({ label, data }: { label: string; data: Record<string, unknown> }) {
  return (
    <section className="grid gap-2">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-2xl border border-border/70 bg-muted/30 p-3 font-mono text-xs text-foreground">
        {JSON.stringify(data, null, 2)}
      </pre>
    </section>
  );
}

function DetailStatusIcon({ status }: { status: StreamNodeEvent['status'] }) {
  if (status === 'succeeded') {
    return <CheckCircle className="h-4 w-4 text-emerald-600" />;
  }
  if (status === 'failed') {
    return <XCircle className="h-4 w-4 text-destructive" />;
  }
  return <Circle className="h-4 w-4 text-muted-foreground" />;
}

function statusText(status: StreamNodeEvent['status']) {
  if (status === 'succeeded') {
    return '成功';
  }
  if (status === 'failed') {
    return '失败';
  }
  return '跳过';
}

export function NodeDetailPanel({ node }: NodeDetailPanelProps) {
  if (!node) {
    return (
      <div className="flex h-full items-center justify-center px-4 text-center text-sm text-muted-foreground">
        点击中栏节点
        <br />
        查看输入/输出详情。
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="grid gap-4 p-4">
        <header className="grid gap-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">节点</p>
          <h3 className="break-words font-mono text-base font-semibold text-foreground">{node.nodeId}</h3>
        </header>

        <section className="flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-muted/30 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <DetailStatusIcon status={node.status} />
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">{statusText(node.status)}</p>
              <p className="text-xs text-muted-foreground">{new Date(node.receivedAt).toLocaleTimeString()}</p>
            </div>
          </div>
          <Badge variant="outline">
            <Clock className="h-3.5 w-3.5" />
            {node.durationMs}ms
          </Badge>
        </section>

        <JsonBlock label="输入" data={node.inputSnapshot} />
        <JsonBlock label="输出" data={node.outputSnapshot} />

        {node.errorMessage ? (
          <section className="grid gap-2">
            <p className="text-xs font-medium uppercase tracking-wide text-destructive">错误信息</p>
            <p className="whitespace-pre-wrap break-words rounded-2xl border border-destructive/30 bg-destructive/5 p-3 font-mono text-xs text-destructive">
              {node.errorMessage}
            </p>
          </section>
        ) : null}
      </div>
    </ScrollArea>
  );
}
