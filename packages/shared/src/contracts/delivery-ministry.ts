import type {
  ActionIntent,
  AgentExecutionState,
  EvaluationResult,
  MemoryRecord,
  ReviewRecord,
  SkillCard,
  TaskRecord,
  ToolExecutionResult
} from '../types';

export interface DeliveryResearchResult {
  summary: string;
  memories: MemoryRecord[];
  skills: SkillCard[];
}

export interface DeliveryExecutionResult {
  intent: ActionIntent;
  toolName: string;
  requiresApproval: boolean;
  tool?: never;
  executionResult?: ToolExecutionResult;
  summary: string;
  serverId?: string;
  capabilityId?: string;
  approvalPreview?: Array<{
    label: string;
    value: string;
  }>;
}

export interface DeliveryReviewResult {
  review: ReviewRecord;
  evaluation: EvaluationResult;
}

export interface DeliveryMinistryLike {
  research(task: TaskRecord): Promise<DeliveryResearchResult>;
  execute(task: TaskRecord, executionSummary: string): Promise<DeliveryExecutionResult>;
  review(task: TaskRecord, executionSummary: string): DeliveryReviewResult;
  buildDelivery(task: TaskRecord, executionSummary: string): string;
  getState(): AgentExecutionState;
}
