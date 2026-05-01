// apps/backend/agent-server/src/workflow-runs/workflow-runs.dto.ts
export class StartWorkflowRunDto {
  workflowId: string;
  input: Record<string, unknown>;
}
