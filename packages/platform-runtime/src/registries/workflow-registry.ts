export interface PlatformWorkflowDescriptor {
  readonly id: string;
  readonly displayName: string;
  readonly agentIds: readonly string[];
}

export interface WorkflowStageEvent {
  readonly workflowId: string;
  readonly nodeId: string;
  readonly status: 'pending' | 'succeeded' | 'failed' | 'skipped';
  readonly durationMs?: number;
  readonly inputSnapshot?: Record<string, unknown>;
  readonly outputSnapshot?: Record<string, unknown>;
}

export interface WorkflowExecutionInput {
  readonly workflowId: string;
  readonly input: Record<string, unknown>;
  readonly onStage?: (event: WorkflowStageEvent) => void;
}

export interface WorkflowExecutionResult<TOutput = unknown> {
  readonly workflowId: string;
  readonly status: 'succeeded' | 'failed';
  readonly output: TOutput;
  readonly trace: readonly WorkflowStageEvent[];
}

export interface PlatformWorkflowExecutor<TOutput = unknown> {
  readonly descriptor: PlatformWorkflowDescriptor;
  readonly execute: (input: WorkflowExecutionInput) => Promise<WorkflowExecutionResult<TOutput>>;
}

export interface WorkflowRegistry {
  listWorkflows(): readonly PlatformWorkflowDescriptor[];
  executeWorkflow(input: WorkflowExecutionInput): Promise<WorkflowExecutionResult>;
}

export function createPlatformWorkflowRegistry(executors: readonly PlatformWorkflowExecutor[] = []): WorkflowRegistry {
  const executorsByWorkflowId = new Map(executors.map(executor => [executor.descriptor.id, executor]));

  return {
    listWorkflows: () => executors.map(executor => executor.descriptor),
    executeWorkflow: async input => {
      const executor = executorsByWorkflowId.get(input.workflowId);
      if (!executor) {
        throw new Error(`Unknown workflowId: ${input.workflowId}`);
      }
      return executor.execute(input);
    }
  };
}
