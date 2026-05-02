import { useCallback, useEffect, useState } from 'react';

import type { WorkflowRunRecord } from './api/workflow-runs.api';
import { listWorkflowRuns, startWorkflowRun } from './api/workflow-runs.api';
import { NodeDetailPanel } from './components/NodeDetailPanel';
import { NodeTimelinePanel } from './components/NodeTimelinePanel';
import { WorkflowSidebar } from './components/WorkflowSidebar';
import type { StreamNodeEvent } from './hooks/useWorkflowStream';
import { useWorkflowStream } from './hooks/useWorkflowStream';
import { workflowRegistry } from './registry/workflow.registry';

export function WorkflowLabPage() {
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(workflowRegistry[0]?.id ?? null);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<StreamNodeEvent | null>(null);
  const [runs, setRuns] = useState<WorkflowRunRecord[]>([]);

  const { nodes, runStatus } = useWorkflowStream(activeRunId);
  const selectedWorkflow = workflowRegistry.find(workflow => workflow.id === selectedWorkflowId) ?? null;

  const loadRuns = useCallback(async () => {
    if (!selectedWorkflowId) {
      setRuns([]);
      return;
    }

    const nextRuns = await listWorkflowRuns(selectedWorkflowId);
    setRuns(nextRuns);
  }, [selectedWorkflowId]);

  useEffect(() => {
    void loadRuns();
  }, [loadRuns]);

  useEffect(() => {
    if (runStatus === 'completed' || runStatus === 'failed') {
      void loadRuns();
    }
  }, [loadRuns, runStatus]);

  async function handleStartRun(payload: Record<string, unknown>) {
    if (!selectedWorkflowId) {
      return;
    }

    setSelectedNode(null);
    const { runId } = await startWorkflowRun({
      workflowId: selectedWorkflowId,
      input: payload
    });
    setActiveRunId(runId);
    setSelectedRunId(runId);
  }

  function handleSelectWorkflow(workflowId: string) {
    setSelectedWorkflowId(workflowId);
    setActiveRunId(null);
    setSelectedRunId(null);
    setSelectedNode(null);
  }

  function handleSelectRun(runId: string) {
    setSelectedRunId(runId);
    setActiveRunId(runId);
    setSelectedNode(null);
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] min-h-[640px] overflow-hidden rounded-lg border border-border bg-background">
      <div className="w-[260px] shrink-0">
        <WorkflowSidebar
          workflows={workflowRegistry}
          selectedWorkflowId={selectedWorkflowId}
          onSelectWorkflow={handleSelectWorkflow}
          runs={runs}
          selectedRunId={selectedRunId}
          onSelectRun={handleSelectRun}
        />
      </div>

      <main className="min-w-0 flex-1 border-r border-border/70">
        <NodeTimelinePanel
          selectedWorkflow={selectedWorkflow}
          nodes={nodes}
          runStatus={runStatus}
          activeRunId={activeRunId}
          selectedNodeId={selectedNode?.nodeId ?? null}
          onStartRun={payload => void handleStartRun(payload)}
          onSelectNode={setSelectedNode}
        />
      </main>

      <div className="w-[360px] shrink-0">
        <NodeDetailPanel node={selectedNode} />
      </div>
    </div>
  );
}
