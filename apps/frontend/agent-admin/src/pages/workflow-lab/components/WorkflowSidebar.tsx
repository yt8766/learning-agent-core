import type { WorkflowRunRecord } from '../api/workflow-runs.api';
import type { WorkflowDefinition } from '../registry/workflow.registry';
import { RunHistoryList } from './RunHistoryList';
import { WorkflowList } from './WorkflowList';

interface WorkflowSidebarProps {
  workflows: WorkflowDefinition[];
  selectedWorkflowId: string | null;
  onSelectWorkflow: (id: string) => void;
  runs: WorkflowRunRecord[];
  selectedRunId: string | null;
  onSelectRun: (runId: string) => void;
}

export function WorkflowSidebar({
  workflows,
  selectedWorkflowId,
  onSelectWorkflow,
  runs,
  selectedRunId,
  onSelectRun
}: WorkflowSidebarProps) {
  return (
    <aside className="flex h-full min-h-0 flex-col gap-5 overflow-y-auto border-r border-border/70 bg-card/90 p-4">
      <WorkflowList workflows={workflows} selectedId={selectedWorkflowId} onSelect={onSelectWorkflow} />
      <RunHistoryList runs={runs} selectedRunId={selectedRunId} onSelect={onSelectRun} />
    </aside>
  );
}
