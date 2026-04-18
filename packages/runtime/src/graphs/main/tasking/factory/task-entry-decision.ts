import type { CreateTaskDto, ExecutionPlanMode } from '@agent/core';

export function resolveRequestedMode(dto: CreateTaskDto): ExecutionPlanMode {
  if (dto.requestedMode) {
    return dto.requestedMode;
  }
  if (dto.imperialDirectIntent?.enabled) {
    return 'imperial_direct';
  }
  if (/^\/plan[-\w]*/i.test(dto.goal.trim())) {
    return 'plan';
  }
  return 'execute';
}

export function resolveCounselorSelection(
  dto: CreateTaskDto,
  context: {
    specialistDomain: string;
    normalizedGoal: string;
    sessionId?: string;
  }
) {
  const selector = dto.counselorSelector ?? {
    strategy: 'task-type' as const,
    key: context.specialistDomain,
    candidateIds: [context.specialistDomain]
  };
  const candidates =
    selector.candidateIds && selector.candidateIds.length > 0
      ? selector.candidateIds
      : [selector.fallbackCounselorId ?? context.specialistDomain];
  const defaultCounselorId = selector.fallbackCounselorId ?? candidates[0] ?? context.specialistDomain;
  const salt = `${context.normalizedGoal}:${dto.context ?? ''}:${context.sessionId ?? ''}:${selector.key ?? ''}:${selector.featureFlag ?? ''}`;
  let selectedCounselorId = defaultCounselorId;
  let selectionReason = 'selector_fallback_default';

  switch (selector.strategy) {
    case 'manual':
      selectedCounselorId = candidates[0] ?? defaultCounselorId;
      selectionReason = 'manual_selector';
      break;
    case 'user-id':
    case 'task-type':
    case 'feature-flag': {
      const index = hashStringToIndex(salt, candidates.length);
      selectedCounselorId = candidates[index] ?? defaultCounselorId;
      selectionReason =
        selector.strategy === 'user-id'
          ? 'by_user_id'
          : selector.strategy === 'feature-flag'
            ? 'by_feature_flag'
            : 'by_task_type';
      break;
    }
    case 'session-ratio': {
      const index = hashStringToWeightedIndex(salt, candidates.length, selector.weights);
      selectedCounselorId = candidates[index] ?? defaultCounselorId;
      selectionReason = 'by_session_ratio';
      break;
    }
    default:
      break;
  }

  const selectedVersion = resolveCounselorVersion(selectedCounselorId);
  return {
    selector: {
      ...selector,
      selectedCounselorId,
      selectedVersion
    },
    defaultCounselorId,
    selectionReason,
    selectedCounselorId,
    selectedVersion
  };
}

function hashStringToIndex(value: string, size: number) {
  if (size <= 1) {
    return 0;
  }
  let hash = 0;
  for (const char of value) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return hash % size;
}

function hashStringToWeightedIndex(value: string, size: number, weights?: number[]) {
  if (size <= 1) {
    return 0;
  }
  const normalizedWeights =
    Array.isArray(weights) && weights.length === size && weights.some(weight => weight > 0)
      ? weights.map(weight => (weight > 0 ? weight : 0))
      : new Array(size).fill(1);
  const total = normalizedWeights.reduce((sum, weight) => sum + weight, 0);
  if (total <= 0) {
    return hashStringToIndex(value, size);
  }
  const hash = hashStringToIndex(value, 10000);
  let cursor = (hash / 10000) * total;
  for (let index = 0; index < normalizedWeights.length; index += 1) {
    cursor -= normalizedWeights[index] ?? 0;
    if (cursor < 0) {
      return index;
    }
  }
  return normalizedWeights.length - 1;
}

function resolveCounselorVersion(counselorId?: string) {
  const match = counselorId?.match(/-(v\d+)$/i);
  return match?.[1]?.toLowerCase();
}
