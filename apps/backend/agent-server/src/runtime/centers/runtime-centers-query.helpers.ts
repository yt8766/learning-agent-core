import type { LocalSkillSuggestionRecord, PlatformApprovalRecord, TaskRecord } from '@agent/core';

import { normalizeExecutionMode } from '../helpers/runtime-architecture-helpers';

type InterruptLike = TaskRecord['activeInterrupt'] | PlatformApprovalRecord['activeInterrupt'];
type ExecutionPlanLike = {
  mode?: string;
};
type TaskInteractionLike = Pick<TaskRecord, 'activeInterrupt' | 'pendingApproval'>;
type TaskExecutionLike = Pick<TaskRecord, 'executionMode' | 'planMode'> & {
  executionPlan?: ExecutionPlanLike;
};

export {
  resolveInterruptPayloadField,
  resolveLocalSkillSuggestionsWithTimeout,
  resolveTaskExecutionMode,
  resolveTaskInteractionKind
} from '../domain/observability/runtime-observability-filters';
