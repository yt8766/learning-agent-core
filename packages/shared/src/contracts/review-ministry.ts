import type {
  AgentExecutionState,
  CritiqueResultRecord,
  EvaluationResult,
  ReviewRecord,
  SpecialistFindingRecord,
  ToolExecutionResult
} from '../types';
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
