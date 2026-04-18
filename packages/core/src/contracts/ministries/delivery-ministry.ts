import type { MemoryRecord } from '../../memory';
import type { EvaluationResult } from '../../knowledge/types/knowledge-runtime.types';
import type { ActionIntent } from '../../primitives/types/primitives.types';
import type { SkillCard } from '../../skills';
import type { TaskRecord } from '../../tasking/types/task-record';
import type { AgentExecutionState, ReviewRecord } from '../../tasking/types/orchestration';
import type { ToolExecutionResult } from '../../governance/types/governance.types';

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
