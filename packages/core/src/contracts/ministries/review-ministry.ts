import type { EvaluationResult } from '../../tasking/types/knowledge-fields';
import type {
  AgentExecutionState,
  CritiqueResultRecord,
  ReviewRecord,
  SpecialistFindingRecord
} from '../../tasking/types/orchestration';
import type { ToolExecutionResult } from '../../tasking/types/governance-fields';
import type { MinistryContractMeta } from './research-ministry';

export interface ReviewMinistryResult {
  review: ReviewRecord;
  evaluation: EvaluationResult;
  critiqueResult?: CritiqueResultRecord;
  specialistFinding?: SpecialistFindingRecord;
  contractMeta: MinistryContractMeta;
}

export interface ReviewMinistryLike {
  review(executionResult: ToolExecutionResult | undefined, executionSummary: string): Promise<ReviewMinistryResult>;
  getState(): AgentExecutionState;
}
