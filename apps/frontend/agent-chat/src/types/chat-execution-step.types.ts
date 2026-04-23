export type ExecutionStepRoute = 'direct-reply' | 'research-first' | 'workflow-execute' | 'approval-recovery';
export type ExecutionStepStage =
  | 'request-received'
  | 'route-selection'
  | 'task-planning'
  | 'research'
  | 'execution'
  | 'review'
  | 'delivery'
  | 'approval-interrupt'
  | 'recovery';
export type ExecutionStepStatus = 'pending' | 'running' | 'completed' | 'blocked';
export type ExecutionStepOwner = 'session' | 'libu' | 'hubu' | 'gongbu' | 'bingbu' | 'xingbu' | 'libu-docs' | 'system';

export interface ExecutionStepRecord {
  id: string;
  route: ExecutionStepRoute;
  stage: ExecutionStepStage;
  label: string;
  owner: ExecutionStepOwner;
  status: ExecutionStepStatus;
  startedAt: string;
  completedAt?: string;
  detail?: string;
  reason?: string;
}
