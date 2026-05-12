import { describe, expect, it } from 'vitest';

import {
  publishSkillToLab,
  promoteSkill,
  disableSkill,
  restoreSkill,
  retireSkill,
  recordSkillExecutionResult
} from '../../src/policies/skill-governance-policy';

function makeSkillCard(overrides: Record<string, unknown> = {}) {
  return {
    id: 'skill-001',
    name: 'GitHub Review',
    description: 'Review pull requests safely.',
    applicableGoals: ['code-review'],
    requiredTools: ['github-api'],
    steps: [{ title: 'Fetch PR', instruction: 'Get PR details', toolNames: ['github-api'] }],
    constraints: ['Do not merge'],
    successSignals: ['Review posted'],
    riskLevel: 'low' as const,
    source: 'execution' as const,
    status: 'lab' as const,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides
  };
}

describe('publishSkillToLab', () => {
  it('sets status to lab and updates timestamp', () => {
    const skill = makeSkillCard({ status: 'stable' });
    const result = publishSkillToLab(skill);

    expect(result.status).toBe('lab');
    expect(result.updatedAt).not.toBe(skill.updatedAt);
    expect(result.id).toBe(skill.id);
  });

  it('preserves all other skill fields', () => {
    const skill = makeSkillCard();
    const result = publishSkillToLab(skill);

    expect(result.name).toBe(skill.name);
    expect(result.description).toBe(skill.description);
    expect(result.riskLevel).toBe(skill.riskLevel);
  });
});

describe('promoteSkill', () => {
  it('sets status to stable and updates timestamp', () => {
    const skill = makeSkillCard({ status: 'lab' });
    const result = promoteSkill(skill);

    expect(result.status).toBe('stable');
    expect(result.updatedAt).not.toBe(skill.updatedAt);
  });
});

describe('disableSkill', () => {
  it('sets status to disabled and records previousStatus', () => {
    const skill = makeSkillCard({ status: 'lab' });
    const result = disableSkill(skill, 'security concern');

    expect(result.status).toBe('disabled');
    expect(result.previousStatus).toBe('lab');
    expect(result.disabledReason).toBe('security concern');
  });

  it('works without an explicit reason', () => {
    const skill = makeSkillCard();
    const result = disableSkill(skill);

    expect(result.status).toBe('disabled');
    expect(result.disabledReason).toBeUndefined();
  });
});

describe('restoreSkill', () => {
  it('restores to previousStatus and clears disabled fields', () => {
    const skill = makeSkillCard({
      status: 'disabled',
      previousStatus: 'stable',
      disabledReason: 'temporarily disabled'
    });
    const result = restoreSkill(skill);

    expect(result.status).toBe('stable');
    expect(result.previousStatus).toBeUndefined();
    expect(result.disabledReason).toBeUndefined();
    expect(result.restoredAt).toBeDefined();
  });

  it('defaults to lab when previousStatus is missing', () => {
    const skill = makeSkillCard({ status: 'disabled' });
    const result = restoreSkill(skill);

    expect(result.status).toBe('lab');
  });
});

describe('retireSkill', () => {
  it('sets status to disabled with retiredAt and reason', () => {
    const skill = makeSkillCard({ status: 'lab' });
    const result = retireSkill(skill, 'poor performance');

    expect(result.status).toBe('disabled');
    expect(result.previousStatus).toBe('lab');
    expect(result.disabledReason).toBe('poor performance');
    expect(result.retiredAt).toBeDefined();
  });

  it('uses default reason when no reason is provided', () => {
    const skill = makeSkillCard();
    const result = retireSkill(skill);

    expect(result.disabledReason).toBe('retired_from_admin');
  });
});

describe('recordSkillExecutionResult', () => {
  it('records a successful run and updates successRate', () => {
    const skill = makeSkillCard();
    const result = recordSkillExecutionResult(skill, 'run-1', true);

    expect(result.sourceRuns).toEqual(['run-1']);
    expect(result.successRate).toBe(1);
    expect(result.promotionState).toBe('validated');
  });

  it('records a failed run', () => {
    const skill = makeSkillCard();
    const result = recordSkillExecutionResult(skill, 'run-1', false);

    expect(result.sourceRuns).toEqual(['run-1']);
    expect(result.successRate).toBe(0);
    expect(result.promotionState).toBe('needs-review');
  });

  it('deduplicates run ids', () => {
    const skill = makeSkillCard({ sourceRuns: ['run-1'] });
    const result = recordSkillExecutionResult(skill, 'run-1', true);

    expect(result.sourceRuns).toEqual(['run-1']);
  });

  it('computes running success rate across multiple runs', () => {
    const skill = makeSkillCard();
    let result = recordSkillExecutionResult(skill, 'run-1', true);
    result = recordSkillExecutionResult(result, 'run-2', false);
    result = recordSkillExecutionResult(result, 'run-3', true);

    expect(result.sourceRuns).toEqual(['run-1', 'run-2', 'run-3']);
    expect(result.successRate).toBeCloseTo(2 / 3);
  });

  describe('governanceRecommendation', () => {
    it('recommends promote when >= 3 runs and >= 85% success rate', () => {
      const skill = makeSkillCard();
      let result = recordSkillExecutionResult(skill, 'r1', true);
      result = recordSkillExecutionResult(result, 'r2', true);
      result = recordSkillExecutionResult(result, 'r3', true);

      expect(result.governanceRecommendation).toBe('promote');
    });

    it('recommends retire when >= 5 runs and < 35% success rate', () => {
      const skill = makeSkillCard();
      let result = recordSkillExecutionResult(skill, 'r1', false);
      result = recordSkillExecutionResult(result, 'r2', false);
      result = recordSkillExecutionResult(result, 'r3', false);
      result = recordSkillExecutionResult(result, 'r4', false);
      result = recordSkillExecutionResult(result, 'r5', true);

      expect(result.governanceRecommendation).toBe('retire');
    });

    it('recommends disable when >= 3 runs and < 50% success rate', () => {
      const skill = makeSkillCard();
      let result = recordSkillExecutionResult(skill, 'r1', false);
      result = recordSkillExecutionResult(result, 'r2', true);
      result = recordSkillExecutionResult(result, 'r3', false);

      expect(result.governanceRecommendation).toBe('disable');
    });

    it('recommends keep-lab when fewer than 3 runs', () => {
      const skill = makeSkillCard();
      const result = recordSkillExecutionResult(skill, 'r1', true);

      expect(result.governanceRecommendation).toBe('keep-lab');
    });
  });

  describe('promotionState', () => {
    it('returns validated when successRate >= 0.8', () => {
      const skill = makeSkillCard();
      let result = recordSkillExecutionResult(skill, 'r1', true);
      result = recordSkillExecutionResult(result, 'r2', true);
      result = recordSkillExecutionResult(result, 'r3', true);
      result = recordSkillExecutionResult(result, 'r4', true);

      expect(result.promotionState).toBe('validated');
    });

    it('returns warming when successRate is between 0.5 and 0.8', () => {
      const skill = makeSkillCard();
      let result = recordSkillExecutionResult(skill, 'r1', true);
      result = recordSkillExecutionResult(result, 'r2', false);
      result = recordSkillExecutionResult(result, 'r3', true);

      expect(result.promotionState).toBe('warming');
    });

    it('returns needs-review when successRate < 0.5', () => {
      const skill = makeSkillCard();
      let result = recordSkillExecutionResult(skill, 'r1', false);
      result = recordSkillExecutionResult(result, 'r2', false);
      result = recordSkillExecutionResult(result, 'r3', true);

      expect(result.promotionState).toBe('needs-review');
    });
  });
});
