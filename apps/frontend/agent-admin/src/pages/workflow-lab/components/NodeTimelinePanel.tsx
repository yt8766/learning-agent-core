import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

import type { RunStatus, StreamNodeEvent } from '../hooks/useWorkflowStream';
import type { WorkflowDefinition } from '../registry/workflow.registry';
import { NodeTimeline } from './NodeTimeline';
import { WorkflowGraphCanvas } from './WorkflowGraphCanvas';
import { WorkflowRunForm } from './WorkflowRunForm';

interface NodeTimelinePanelProps {
  selectedWorkflow: WorkflowDefinition | null;
  nodes: StreamNodeEvent[];
  runStatus: RunStatus;
  activeRunId: string | null;
  selectedNodeId: string | null;
  onStartRun: (payload: Record<string, unknown>) => void;
  onSelectNode: (node: StreamNodeEvent) => void;
}

function runStatusLabel(status: RunStatus) {
  if (status === 'running') {
    return 'running';
  }
  if (status === 'completed') {
    return 'completed';
  }
  if (status === 'failed') {
    return 'failed';
  }
  return 'idle';
}

export function NodeTimelinePanel({
  selectedWorkflow,
  nodes,
  runStatus,
  activeRunId,
  selectedNodeId,
  onStartRun,
  onSelectNode
}: NodeTimelinePanelProps) {
  if (!selectedWorkflow) {
    return (
      <div className="flex h-full items-center justify-center px-4 text-center text-sm text-muted-foreground">
        请从左侧选择一个工作流。
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="border-b border-border/70 bg-card px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-foreground">{selectedWorkflow.name}</h2>
            <p className="mt-1 text-xs text-muted-foreground">{selectedWorkflow.description}</p>
          </div>
          <div className="flex flex-shrink-0 flex-col items-end gap-2">
            <Badge variant={runStatus === 'failed' ? 'destructive' : runStatus === 'completed' ? 'success' : 'outline'}>
              {runStatusLabel(runStatus)}
            </Badge>
            {activeRunId ? (
              <span className="font-mono text-xs text-muted-foreground">{activeRunId.slice(0, 8)}</span>
            ) : null}
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <section className="border-b border-border/60 p-4">
          <WorkflowRunForm workflow={selectedWorkflow} onSubmit={onStartRun} isRunning={runStatus === 'running'} />
        </section>

        <ScrollArea className="min-h-0 flex-1">
          <div className="grid gap-4 p-4">
            <WorkflowGraphCanvas
              workflow={selectedWorkflow}
              nodes={nodes}
              runStatus={runStatus}
              selectedNodeId={selectedNodeId}
              onSelectNode={onSelectNode}
            />
            <NodeTimeline
              nodes={nodes}
              runStatus={runStatus}
              onSelectNode={onSelectNode}
              selectedNodeId={selectedNodeId}
            />
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
