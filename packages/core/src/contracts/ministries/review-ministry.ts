import type { EvaluationResult } from '../../knowledge/types/knowledge-runtime.types';
import type {
  AgentExecutionState,
  CritiqueResultRecord,
  ReviewRecord,
  SpecialistFindingRecord
} from '../../tasking/types/orchestration';
import type { ToolExecutionResult } from '../../governance/types/governance.types';
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
