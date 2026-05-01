export interface WorkflowNodeTrace {
  nodeId: string;
  status: 'succeeded' | 'failed' | 'skipped';
  durationMs: number;
  inputSnapshot: Record<string, unknown>;
  outputSnapshot: Record<string, unknown>;
  errorMessage?: string;
}

export interface WorkflowResult {
  trace: WorkflowNodeTrace[];
}
