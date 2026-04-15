import { AgentRole, type DispatchInstruction, type TaskRecord } from '@agent/shared';

const DISPATCH_KIND_ORDER: Record<DispatchInstruction['kind'], number> = {
  strategy: 0,
  ministry: 1,
  fallback: 2
};

function summarizeDispatchObjectives(
  dispatches: DispatchInstruction[],
  kind: DispatchInstruction['kind'],
  fallbackSummary: string
) {
  const objectives = dispatches
    .filter(dispatch => dispatch.kind === kind)
    .map(dispatch => dispatch.objective.trim())
    .filter(Boolean);

  return {
    summary: objectives.length ? objectives.slice(0, 2).join('；') : fallbackSummary,
    dispatchCount: objectives.length
  };
}

export function orderRuntimeDispatches(dispatches: DispatchInstruction[]): DispatchInstruction[] {
  return [...dispatches].sort((left, right) => {
    const byKind = DISPATCH_KIND_ORDER[left.kind] - DISPATCH_KIND_ORDER[right.kind];
    if (byKind !== 0) {
      return byKind;
    }
    return left.subTaskId.localeCompare(right.subTaskId);
  });
}

export function buildContextFilterAudienceSlices(task: TaskRecord, dispatches: DispatchInstruction[]) {
  return {
    strategy: summarizeDispatchObjectives(dispatches, 'strategy', '当前未单列群辅票拟，由六部直接承接执行。'),
    ministry: summarizeDispatchObjectives(dispatches, 'ministry', '当前未形成六部执行票拟。'),
    fallback: summarizeDispatchObjectives(dispatches, 'fallback', '当前无需通才兜底。')
  };
}

function findDispatchObjective(
  dispatches: DispatchInstruction[],
  matcher: (dispatch: DispatchInstruction) => boolean,
  fallback?: string
) {
  return dispatches.find(matcher)?.objective ?? fallback;
}

export function resolveResearchDispatchObjective(dispatches: DispatchInstruction[]) {
  return findDispatchObjective(
    dispatches,
    dispatch => dispatch.to === AgentRole.RESEARCH && dispatch.kind !== 'fallback',
    'Research shared memory and skills'
  );
}

export function resolveExecutionDispatchObjective(dispatches: DispatchInstruction[]) {
  return findDispatchObjective(
    dispatches,
    dispatch => dispatch.to === AgentRole.EXECUTOR && dispatch.kind !== 'fallback',
    'Execute the candidate action'
  );
}
