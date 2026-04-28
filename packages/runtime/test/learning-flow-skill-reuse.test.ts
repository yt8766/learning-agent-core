import { describe, expect, it, vi } from 'vitest';

import type { ReviewRecord, SkillCard } from '@agent/core';
import type { EvaluationResult } from '@agent/knowledge';
import { LearningFlow } from '../src/flows/learning';

const baseEvaluation: EvaluationResult = {
  success: true,
  quality: 'high',
  shouldWriteMemory: false,
  shouldCreateRule: false
};

const baseReview: ReviewRecord = {
  decision: 'approved',
  summary: 'Skill reuse was successful.',
  findings: []
};

describe('LearningFlow installed skill reuse recording', () => {
  it('emits a workspace skill reuse record after an installed skill execution is recorded', async () => {
    const recordWorkspaceSkillReuse = vi.fn(async () => undefined);
    const updatedAt = '2026-04-26T12:00:00.000Z';
    const updatedSkill: SkillCard = {
      id: 'skill-browser-evidence',
      name: 'Browser Evidence',
      description: 'Capture browser evidence.',
      version: '1.0.0',
      status: 'stable',
      steps: [],
      createdAt: updatedAt,
      updatedAt,
      successRate: 1,
      promotionState: 'trusted',
      governanceRecommendation: 'promote-stable'
    };

    const flow = new LearningFlow({
      memoryRepository: { append: vi.fn(), search: vi.fn(async () => []) },
      ruleRepository: { append: vi.fn(), list: vi.fn(async () => []) },
      skillRegistry: {
        publishToLab: vi.fn(),
        recordExecutionResult: vi.fn(async () => updatedSkill)
      },
      recordWorkspaceSkillReuse
    } as any);

    await flow.persistReviewArtifacts(
      {
        id: 'task-skill-reuse',
        runId: 'run-skill-reuse',
        goal: 'Reuse browser evidence skill',
        status: 'completed',
        result: 'Done',
        usedInstalledSkills: ['installed-skill:skill-browser-evidence', 'skill-browser-evidence'],
        agentStates: [],
        trace: [],
        externalSources: [],
        reusedMemories: [],
        reusedRules: [],
        reusedSkills: []
      } as any,
      'Reuse browser evidence skill',
      baseEvaluation,
      baseReview,
      'Done',
      {
        buildMemoryRecord: vi.fn(),
        buildRuleRecord: vi.fn(),
        buildSkillDraft: vi.fn(),
        addTrace: vi.fn()
      }
    );

    expect(recordWorkspaceSkillReuse).toHaveBeenCalledTimes(1);
    expect(recordWorkspaceSkillReuse).toHaveBeenCalledWith({
      id: 'reuse:run-skill-reuse:skill-browser-evidence',
      skillId: 'skill-browser-evidence',
      taskId: 'task-skill-reuse',
      outcome: 'succeeded',
      evidenceRefs: ['task-skill-reuse:skill-governance:skill-browser-evidence'],
      reusedAt: updatedAt
    });
  });

  it('does not emit a workspace skill reuse record when the installed skill cannot be updated', async () => {
    const recordWorkspaceSkillReuse = vi.fn(async () => undefined);
    const flow = new LearningFlow({
      memoryRepository: { append: vi.fn(), search: vi.fn(async () => []) },
      ruleRepository: { append: vi.fn(), list: vi.fn(async () => []) },
      skillRegistry: {
        publishToLab: vi.fn(),
        recordExecutionResult: vi.fn(async () => undefined)
      },
      recordWorkspaceSkillReuse
    } as any);

    await flow.persistReviewArtifacts(
      {
        id: 'task-missing-skill',
        goal: 'Try missing skill',
        status: 'completed',
        result: 'Done',
        usedInstalledSkills: ['installed-skill:missing'],
        agentStates: [],
        trace: [],
        externalSources: [],
        reusedMemories: [],
        reusedRules: [],
        reusedSkills: []
      } as any,
      'Try missing skill',
      baseEvaluation,
      baseReview,
      'Done',
      {
        buildMemoryRecord: vi.fn(),
        buildRuleRecord: vi.fn(),
        buildSkillDraft: vi.fn(),
        addTrace: vi.fn()
      }
    );

    expect(recordWorkspaceSkillReuse).not.toHaveBeenCalled();
  });
});
