import { describe, expect, it } from 'vitest';

import {
  isDiagnosisTask,
  appendDiagnosisEvidence,
  buildFreshnessSourceSummary,
  buildCitationSourceSummary
} from '../src/graphs/main/runtime/knowledge/main-graph-knowledge';

function makeTask(overrides: Record<string, unknown> = {}) {
  return {
    id: 'task-1',
    runId: 'run-1',
    goal: 'test goal',
    context: undefined,
    externalSources: [],
    ...overrides
  } as any;
}

describe('main-graph-knowledge (direct)', () => {
  describe('isDiagnosisTask', () => {
    it('detects diagnosis_for in context', () => {
      expect(isDiagnosisTask({ goal: '', context: 'diagnosis_for:task-123' })).toBe(true);
    });

    it('detects 请诊断任务 in goal', () => {
      expect(isDiagnosisTask({ goal: '请诊断任务 #123' })).toBe(true);
    });

    it('detects agent 错误 in goal', () => {
      expect(isDiagnosisTask({ goal: 'agent 错误处理' })).toBe(true);
    });

    it('detects 恢复方案 in goal', () => {
      expect(isDiagnosisTask({ goal: '提供恢复方案' })).toBe(true);
    });

    it('detects diagnose task in goal', () => {
      expect(isDiagnosisTask({ goal: 'diagnose task failure' })).toBe(true);
    });

    it('returns false for normal goal', () => {
      expect(isDiagnosisTask({ goal: 'write a function' })).toBe(false);
    });

    it('returns false for empty goal and context', () => {
      expect(isDiagnosisTask({ goal: '', context: '' })).toBe(false);
    });

    it('is case-insensitive', () => {
      expect(isDiagnosisTask({ goal: 'DIAGNOSE TASK failure' })).toBe(true);
    });
  });

  describe('appendDiagnosisEvidence', () => {
    it('does nothing for non-diagnosis task', () => {
      const task = makeTask({ goal: 'normal task' });
      appendDiagnosisEvidence(task, { decision: 'pass' } as any, 'summary', 'answer');
      expect(task.externalSources).toEqual([]);
    });

    it('adds evidence for diagnosis task', () => {
      const task = makeTask({ goal: '请诊断任务 #1', context: '' });
      appendDiagnosisEvidence(task, { decision: 'pass', notes: [] } as any, 'summary', 'answer');
      expect(task.externalSources).toHaveLength(1);
      expect(task.externalSources[0].sourceType).toBe('diagnosis_result');
    });

    it('does not duplicate evidence', () => {
      const task = makeTask({ goal: '请诊断任务 #1', context: '' });
      appendDiagnosisEvidence(task, { decision: 'pass', notes: [] } as any, 'summary', 'answer');
      appendDiagnosisEvidence(task, { decision: 'pass', notes: [] } as any, 'summary', 'answer');
      expect(task.externalSources).toHaveLength(1);
    });

    it('initializes externalSources when undefined', () => {
      const task = makeTask({ goal: '请诊断任务 #1', externalSources: undefined });
      appendDiagnosisEvidence(task, { decision: 'pass', notes: [] } as any, 'summary', 'answer');
      expect(task.externalSources).toHaveLength(1);
    });
  });

  describe('buildFreshnessSourceSummary', () => {
    it('returns undefined when not freshness sensitive', () => {
      const task = makeTask();
      expect(buildFreshnessSourceSummary(task, false)).toBeUndefined();
    });

    it('returns fallback message when no sources', () => {
      const task = makeTask();
      const result = buildFreshnessSourceSummary(task, true);
      expect(result).toContain('未记录到可用来源');
    });

    it('counts official and curated sources', () => {
      const task = makeTask({
        externalSources: [
          { sourceType: 'web', trustClass: 'official' },
          { sourceType: 'web', trustClass: 'curated' },
          { sourceType: 'document', trustClass: 'community' }
        ]
      });
      const result = buildFreshnessSourceSummary(task, true);
      expect(result).toContain('3 条来源');
      expect(result).toContain('官方来源 1 条');
      expect(result).toContain('策展来源 1 条');
    });

    it('filters out freshness_meta sources', () => {
      const task = makeTask({
        externalSources: [
          { sourceType: 'freshness_meta', trustClass: 'internal' },
          { sourceType: 'web', trustClass: 'official' }
        ]
      });
      const result = buildFreshnessSourceSummary(task, true);
      expect(result).toContain('1 条来源');
    });

    it('lists source types', () => {
      const task = makeTask({
        externalSources: [
          { sourceType: 'web', trustClass: 'official' },
          { sourceType: 'document', trustClass: 'curated' }
        ]
      });
      const result = buildFreshnessSourceSummary(task, true);
      expect(result).toContain('来源类型');
    });
  });

  describe('buildCitationSourceSummary', () => {
    it('returns undefined when no sources', () => {
      const task = makeTask();
      expect(buildCitationSourceSummary(task)).toBeUndefined();
    });

    it('filters out freshness_meta and web_search_result sources', () => {
      const task = makeTask({
        externalSources: [
          { sourceType: 'freshness_meta', sourceUrl: 'https://example.com' },
          { sourceType: 'web_search_result', sourceUrl: 'https://example.com' }
        ]
      });
      expect(buildCitationSourceSummary(task)).toBeUndefined();
    });

    it('includes sources with sourceUrl', () => {
      const task = makeTask({
        externalSources: [{ sourceType: 'web', sourceUrl: 'https://example.com/page1', summary: 'Page 1' }]
      });
      const result = buildCitationSourceSummary(task);
      expect(result).toBeDefined();
      expect(result).toContain('example.com');
    });

    it('includes document sources', () => {
      const task = makeTask({
        externalSources: [{ sourceType: 'document', summary: 'Doc 1' }]
      });
      const result = buildCitationSourceSummary(task);
      expect(result).toBeDefined();
      expect(result).toContain('文档');
    });

    it('caps at 5 sources', () => {
      const task = makeTask({
        externalSources: Array.from({ length: 10 }, (_, i) => ({
          sourceType: 'web',
          sourceUrl: `https://example.com/page${i}`,
          summary: `Page ${i}`
        }))
      });
      const result = buildCitationSourceSummary(task);
      expect(result).toBeDefined();
    });

    it('returns undefined for sources without sourceUrl and non-document/web type', () => {
      const task = makeTask({
        externalSources: [{ sourceType: 'internal', summary: 'internal note' }]
      });
      expect(buildCitationSourceSummary(task)).toBeUndefined();
    });
  });
});
