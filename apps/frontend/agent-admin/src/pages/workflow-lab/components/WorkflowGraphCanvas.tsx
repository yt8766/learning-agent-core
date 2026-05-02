import { AlertTriangle, CheckCircle2, Circle, Clock3, LoaderCircle } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

import type { RunStatus, StreamNodeEvent } from '../hooks/useWorkflowStream';
import type { WorkflowDefinition, WorkflowGraphNodeDef } from '../registry/workflow.registry';

interface WorkflowGraphCanvasProps {
  workflow: WorkflowDefinition;
  nodes: StreamNodeEvent[];
  runStatus: RunStatus;
  selectedNodeId: string | null;
  onSelectNode: (node: StreamNodeEvent) => void;
}

type GraphNodeStatus = StreamNodeEvent['status'] | 'running' | 'pending';

function buildNodeEvents(nodes: StreamNodeEvent[]) {
  return new Map(nodes.map(node => [node.nodeId, node]));
}

function inferNodeStatus(
  node: WorkflowGraphNodeDef,
  index: number,
  workflow: WorkflowDefinition,
  events: Map<string, StreamNodeEvent>,
  runStatus: RunStatus
): GraphNodeStatus {
  const event = events.get(node.id);
  if (event) {
    return event.status;
  }

  if (runStatus !== 'running') {
    return 'pending';
  }

  const previousNodes = workflow.graph.nodes.slice(0, index);
  const allPreviousSucceeded = previousNodes.every(previous => events.get(previous.id)?.status === 'succeeded');
  return allPreviousSucceeded ? 'running' : 'pending';
}

function StatusIcon({ status }: { status: GraphNodeStatus }) {
  if (status === 'succeeded') {
    return <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />;
  }
  if (status === 'failed') {
    return <AlertTriangle className="h-4 w-4 text-destructive" aria-hidden="true" />;
  }
  if (status === 'running') {
    return <LoaderCircle className="h-4 w-4 animate-spin text-blue-600" aria-hidden="true" />;
  }
  if (status === 'skipped') {
    return <Clock3 className="h-4 w-4 text-amber-600" aria-hidden="true" />;
  }
  return <Circle className="h-4 w-4 text-muted-foreground" aria-hidden="true" />;
}

function nodeTone(status: GraphNodeStatus) {
  if (status === 'succeeded') {
    return 'border-emerald-200 bg-emerald-50/70';
  }
  if (status === 'failed') {
    return 'border-destructive/30 bg-destructive/5';
  }
  if (status === 'running') {
    return 'border-blue-300 bg-blue-50/80 shadow-[0_0_0_3px_rgb(59_130_246_/_0.12)]';
  }
  if (status === 'skipped') {
    return 'border-amber-200 bg-amber-50/70';
  }
  return 'border-border/70 bg-background';
}

function statusLabel(status: GraphNodeStatus) {
  if (status === 'succeeded') {
    return 'succeeded';
  }
  if (status === 'failed') {
    return 'failed';
  }
  if (status === 'running') {
    return 'running';
  }
  if (status === 'skipped') {
    return 'skipped';
  }
  return 'pending';
}

export function WorkflowGraphCanvas({
  workflow,
  nodes,
  runStatus,
  selectedNodeId,
  onSelectNode
}: WorkflowGraphCanvasProps) {
  const events = buildNodeEvents(nodes);

  return (
    <section
      data-workflow-graph-canvas="true"
      className="grid gap-3 rounded-2xl border border-border/70 bg-background p-4"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Graph</p>
          <p className="mt-1 truncate text-sm text-muted-foreground">
            {workflow.graph.nodes.length} nodes / {workflow.graph.edges.length} edges
          </p>
        </div>
        <Badge variant={runStatus === 'failed' ? 'destructive' : runStatus === 'completed' ? 'success' : 'outline'}>
          {runStatus}
        </Badge>
      </div>

      <div className="grid gap-2">
        {workflow.graph.nodes.map((node, index) => {
          const event = events.get(node.id);
          const status = inferNodeStatus(node, index, workflow, events, runStatus);
          const isSelected = selectedNodeId === node.id;

          return (
            <button
              key={node.id}
              type="button"
              data-node-id={node.id}
              data-node-status={status}
              data-selected={isSelected ? 'true' : undefined}
              disabled={!event}
              onClick={() => {
                if (event) {
                  onSelectNode(event);
                }
              }}
              className={cn(
                'grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border px-3 py-3 text-left text-sm transition',
                nodeTone(status),
                event ? 'cursor-pointer hover:border-ring/40' : 'cursor-default',
                isSelected ? 'ring-2 ring-ring/40' : null
              )}
            >
              <StatusIcon status={status} />
              <span className="min-w-0">
                <span className="block truncate font-medium text-foreground">{node.label}</span>
                <span className="mt-0.5 block truncate font-mono text-xs text-muted-foreground">{node.id}</span>
              </span>
              <span className="flex shrink-0 flex-col items-end gap-1">
                <Badge variant={status === 'failed' ? 'destructive' : status === 'succeeded' ? 'success' : 'outline'}>
                  {statusLabel(status)}
                </Badge>
                {event ? <span className="font-mono text-xs text-muted-foreground">{event.durationMs}ms</span> : null}
              </span>
            </button>
          );
        })}
      </div>

      <div className="grid gap-1 rounded-xl border border-border/60 bg-muted/20 p-3">
        {workflow.graph.edges.map(edge => (
          <div key={`${edge.from}-${edge.to}`} className="font-mono text-xs text-muted-foreground">
            {edge.from} → {edge.to}
          </div>
        ))}
      </div>
    </section>
  );
}
