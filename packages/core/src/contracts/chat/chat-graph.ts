import type { MemoryRecord } from '../../tasking/types/memory-fields';
import type { ToolExecutionResult } from '../../tasking/types/governance-fields';
import type {
  ActionIntent,
  ApprovalStatus,
  ExecutionStepRecord,
  ReviewDecision
} from '../../primitives/types/primitives.types';
import type { SkillCard } from '../../skills';
import type { DispatchInstruction } from '../../tasking/types/orchestration';

export interface RuntimeAgentGraphState {
  taskId: string;
  goal: string;
  context?: string;
  constraints: string[];
  currentPlan: string[];
  currentStep?: string;
  executionSteps?: ExecutionStepRecord[];
  currentExecutionStep?: ExecutionStepRecord;
  toolIntent?: ActionIntent;
  approvalRequired: boolean;
  approvalStatus?: ApprovalStatus;
  observations: string[];
  retrievedMemories: MemoryRecord[];
  retrievedSkills: SkillCard[];
  evaluation?: unknown;
  reflection?: unknown;
  finalAnswer?: string;
  dispatches: DispatchInstruction[];
  researchSummary?: string;
  toolName?: string;
  pendingToolInput?: Record<string, unknown>;
  executionSummary?: string;
  executionResult?: ToolExecutionResult;
  reviewDecision?: ReviewDecision;
  shouldRetry: boolean;
  terminateAfterPlanning?: boolean;
  retryCount: number;
  maxRetries: number;
  resumeFromApproval: boolean;
}

export interface AgentGraphHandlers {
  goalIntake?: (state: RuntimeAgentGraphState) => Promise<RuntimeAgentGraphState>;
  route?: (state: RuntimeAgentGraphState) => Promise<RuntimeAgentGraphState>;
  managerPlan?: (state: RuntimeAgentGraphState) => Promise<RuntimeAgentGraphState>;
  dispatch?: (state: RuntimeAgentGraphState) => Promise<RuntimeAgentGraphState>;
  research?: (state: RuntimeAgentGraphState) => Promise<RuntimeAgentGraphState>;
  execute?: (state: RuntimeAgentGraphState) => Promise<RuntimeAgentGraphState>;
  review?: (state: RuntimeAgentGraphState) => Promise<RuntimeAgentGraphState>;
  finish?: (state: RuntimeAgentGraphState) => Promise<RuntimeAgentGraphState>;
}
