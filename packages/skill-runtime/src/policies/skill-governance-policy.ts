import type { SkillCard } from '@agent/core';

export function publishSkillToLab(skill: SkillCard): SkillCard {
  return {
    ...skill,
    status: 'lab',
    updatedAt: new Date().toISOString()
  };
}

export function promoteSkill(skill: SkillCard): SkillCard {
  return {
    ...skill,
    status: 'stable',
    updatedAt: new Date().toISOString()
  };
}

export function disableSkill(skill: SkillCard, reason?: string): SkillCard {
  return {
    ...skill,
    previousStatus: skill.status,
    status: 'disabled',
    disabledReason: reason,
    updatedAt: new Date().toISOString()
  };
}

export function restoreSkill(skill: SkillCard): SkillCard {
  return {
    ...skill,
    status: skill.previousStatus ?? 'lab',
    previousStatus: undefined,
    disabledReason: undefined,
    restoredAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

export function retireSkill(skill: SkillCard, reason?: string): SkillCard {
  return {
    ...skill,
    previousStatus: skill.status,
    status: 'disabled',
    disabledReason: reason ?? 'retired_from_admin',
    retiredAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

export function recordSkillExecutionResult(skill: SkillCard, runId: string, success: boolean): SkillCard {
  const sourceRuns = Array.from(new Set([...(skill.sourceRuns ?? []), runId]));
  const previousRuns = skill.sourceRuns?.length ?? 0;
  const previousSuccesses = Math.round((skill.successRate ?? 0) * previousRuns);
  const nextRuns = sourceRuns.length;
  const nextSuccesses = previousSuccesses + (success ? 1 : 0);
  const successRate = nextRuns > 0 ? nextSuccesses / nextRuns : 0;

  return {
    ...skill,
    sourceRuns,
    successRate,
    promotionState: successRate >= 0.8 ? 'validated' : successRate >= 0.5 ? 'warming' : 'needs-review',
    governanceRecommendation:
      nextRuns >= 3 && successRate >= 0.85
        ? 'promote'
        : nextRuns >= 5 && successRate < 0.35
          ? 'retire'
          : nextRuns >= 3 && successRate < 0.5
            ? 'disable'
            : 'keep-lab',
    updatedAt: new Date().toISOString()
  };
}
