export interface PlatformWorkflowDescriptor {
  readonly id: string;
  readonly displayName: string;
  readonly agentIds: readonly string[];
}

export interface WorkflowRegistry {
  listWorkflows(): readonly PlatformWorkflowDescriptor[];
}

export function createOfficialWorkflowRegistry(): WorkflowRegistry {
  return {
    listWorkflows: () => []
  };
}
