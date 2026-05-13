import { describe, expect, it } from 'vitest';

import { isDiagnosisTask } from '../src/flows/learning/shared/learning-task-diagnosis';
import { shouldExtractSkillForTask } from '../src/flows/learning/shared/learning-skill-extraction';
import { deriveEvidence } from '../src/flows/learning/shared/learning-task-evidence';

function makeTask(overrides: Record<string, unknown> = {}) {
  return {
    id: 'task-1',
    goal: 'test goal',
    context: 'test context',
    result: 'test result',
    trace: [],
    usedInstalledSkills: [],
    usedCompanyWorkers: [],
    runId: 'run-1',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides
  } as any;
}

describe('learning-shared (direct)', () => {
  describe('isDiagnosisTask', () => {
    it('returns true when goal contains 请诊断任务', () => {
      expect(isDiagnosisTask(makeTask({ goal: '请诊断任务 task-123' }))).toBe(true);
    });

    it('returns true when goal contains agent 错误', () => {
      expect(isDiagnosisTask(makeTask({ goal: 'agent 错误分析' }))).toBe(true);
    });

    it('returns true when goal contains 恢复方案', () => {
      expect(isDiagnosisTask(makeTask({ goal: '查找恢复方案' }))).toBe(true);
    });

    it('returns true when goal contains diagnose task', () => {
      expect(isDiagnosisTask(makeTask({ goal: 'diagnose task abc' }))).toBe(true);
    });

    it('returns true when context contains diagnosis_for:', () => {
      expect(isDiagnosisTask(makeTask({ context: 'diagnosis_for:task-123' }))).toBe(true);
    });

    it('returns false for normal task', () => {
      expect(isDiagnosisTask(makeTask())).toBe(false);
    });
  });

  describe('shouldExtractSkillForTask', () => {
    it('returns false when no evaluation provided', () => {
      expect(shouldExtractSkillForTask(makeTask())).toBe(false);
    });

    it('returns false when evaluation.shouldExtractSkill is false', () => {
      expect(shouldExtractSkillForTask(makeTask(), { shouldExtractSkill: false } as any)).toBe(false);
    });

    it('returns true when evaluation enables it and no blocked pattern', () => {
      expect(shouldExtractSkillForTask(makeTask(), { shouldExtractSkill: true } as any)).toBe(true);
    });

    it('returns false for report task even with evaluation', () => {
      expect(shouldExtractSkillForTask(makeTask({ goal: '生成周报' }), { shouldExtractSkill: true } as any)).toBe(
        false
      );
    });

    it('returns false for writing task with evaluation', () => {
      expect(shouldExtractSkillForTask(makeTask({ goal: '撰写周报' }), { shouldExtractSkill: true } as any)).toBe(
        false
      );
    });

    it('returns false for translation task', () => {
      expect(shouldExtractSkillForTask(makeTask({ goal: '翻译这段文字' }), { shouldExtractSkill: true } as any)).toBe(
        false
      );
    });

    it('returns false for 润色 task', () => {
      expect(shouldExtractSkillForTask(makeTask({ goal: '润色这篇文章' }), { shouldExtractSkill: true } as any)).toBe(
        false
      );
    });
  });

  describe('deriveEvidence', () => {
    it('returns empty array for task with no traces', () => {
      const task = makeTask({ trace: [] });
      expect(deriveEvidence(task)).toEqual([]);
    });

    it('derives evidence from trace data with sourceUrl', () => {
      const task = makeTask({
        trace: [
          { summary: 'found result', data: { sourceUrl: 'https://example.com/article' }, at: '2026-01-01T00:00:00Z' }
        ]
      });
      const evidence = deriveEvidence(task);
      expect(evidence.length).toBeGreaterThan(0);
      expect(evidence[0].sourceUrl).toBe('https://example.com/article');
    });

    it('derives evidence from trace data without sourceUrl', () => {
      const task = makeTask({
        trace: [{ summary: 'step completed', data: {}, at: '2026-01-01T00:00:00Z' }]
      });
      const evidence = deriveEvidence(task);
      expect(evidence.length).toBeGreaterThan(0);
      expect(evidence[0].sourceType).toBe('trace');
    });

    it('deduplicates traces with same sourceType and sourceUrl', () => {
      const task = makeTask({
        trace: [
          { summary: 'found', data: { sourceUrl: 'https://example.com' }, at: '2026-01-01T00:00:00Z' },
          { summary: 'found again', data: { sourceUrl: 'https://example.com' }, at: '2026-01-01T00:01:00Z' }
        ]
      });
      const evidence = deriveEvidence(task);
      expect(evidence).toHaveLength(1);
    });

    it('creates evidence from usedInstalledSkills', () => {
      const task = makeTask({ usedInstalledSkills: ['skill-a'] });
      const evidence = deriveEvidence(task);
      const skillEvidence = evidence.find(e => e.sourceType === 'installed_skill');
      expect(skillEvidence).toBeDefined();
    });

    it('creates evidence from usedCompanyWorkers', () => {
      const task = makeTask({ usedCompanyWorkers: ['worker-1'] });
      const evidence = deriveEvidence(task);
      const workerEvidence = evidence.find(e => e.sourceType === 'company_worker');
      expect(workerEvidence).toBeDefined();
    });

    it('limits total evidence to 12', () => {
      const task = makeTask({
        trace: Array.from({ length: 15 }, (_, i) => ({
          summary: `step ${i}`,
          data: { sourceUrl: `https://example.com/${i}` },
          at: '2026-01-01T00:00:00Z'
        }))
      });
      const evidence = deriveEvidence(task);
      expect(evidence.length).toBeLessThanOrEqual(12);
    });

    it('uses custom sourceType from data', () => {
      const task = makeTask({
        trace: [
          {
            summary: 'step',
            data: { sourceType: 'custom_type', sourceUrl: 'https://example.com' },
            at: '2026-01-01T00:00:00Z'
          }
        ]
      });
      const evidence = deriveEvidence(task);
      expect(evidence[0].sourceType).toBe('custom_type');
    });
  });
});
