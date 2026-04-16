import type {
  ExecutionTrace,
  MemoryEventRecord,
  MemoryEvidenceLinkRecord,
  MemoryRecord,
  MemorySearchReason,
  MemorySearchRequest,
  MemorySearchResult,
  ReflectionRecord,
  ResolutionCandidateRecord,
  UserProfileRecord
} from '@agent/core';
import type { MemoryType } from './primitives';

export type { ExecutionTrace } from '@agent/core';
export type {
  MemoryRecord,
  MemoryRecord as SharedMemoryRecord,
  MemoryEventRecord,
  MemoryEvidenceLinkRecord,
  MemorySearchReason,
  MemorySearchRequest,
  MemorySearchResult,
  ReflectionRecord,
  ResolutionCandidateRecord,
  RuleRecord as SharedRuleRecord,
  RuleRecord,
  UserProfileRecord
} from '@agent/core';

export interface ReflectionResult {
  failureReason?: string;
  rootCause?: string;
  whatWorked: string[];
  whatFailed: string[];
  nextAttemptAdvice: string[];
  memoryCandidate?: MemoryRecord;
}
