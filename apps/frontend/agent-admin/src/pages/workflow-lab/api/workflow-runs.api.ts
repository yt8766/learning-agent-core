// apps/frontend/agent-admin/src/pages/workflow-lab/api/workflow-runs.api.ts
import { request } from '@/api/admin-api-core';

export interface StartWorkflowRunRequest {
  workflowId: string;
  input: Record<string, unknown>;
}

export interface StartWorkflowRunResponse {
  runId: string;
}

export interface WorkflowRunRecord {
  id: string;
  workflowId: string;
  status: 'running' | 'completed' | 'failed' | 'pending';
  startedAt: number;
  completedAt: number | null;
}

export interface WorkflowRunDetail extends WorkflowRunRecord {
  inputData: Record<string, unknown> | null;
  traceData: WorkflowNodeTrace[] | null;
}

export interface WorkflowNodeTrace {
  nodeId: string;
  status: 'succeeded' | 'failed' | 'skipped';
  durationMs: number;
  inputSnapshot: Record<string, unknown>;
  outputSnapshot: Record<string, unknown>;
  errorMessage?: string;
}

export async function startWorkflowRun(req: StartWorkflowRunRequest): Promise<StartWorkflowRunResponse> {
  return request<StartWorkflowRunResponse>('/workflow-runs', {
    method: 'POST',
    body: JSON.stringify(req)
  });
}

export async function listWorkflowRuns(workflowId?: string): Promise<WorkflowRunRecord[]> {
  const qs = workflowId ? `?workflowId=${encodeURIComponent(workflowId)}` : '';
  return request<WorkflowRunRecord[]>(`/workflow-runs${qs}`);
}

export async function getWorkflowRun(id: string): Promise<WorkflowRunDetail> {
  return request<WorkflowRunDetail>(`/workflow-runs/${id}`);
}
