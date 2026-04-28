import type { EvaluationResult } from '../../tasking/types/knowledge-fields';
import type { MemoryRecord } from '../../tasking/types/memory-fields';
import type { ActionIntent } from '../../primitives/types/primitives.types';
import type { SkillCard } from '../../skills';
import type { TaskRecord } from '../../tasking/types/task-record';
import type { AgentExecutionState, ReviewRecord } from '../../tasking/types/orchestration';
import type { ToolExecutionResult } from '../../tasking/types/governance-fields';

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
