import { describe, expect, it, vi } from 'vitest';

import { autoPersistResearchMemory, evaluateResearchJob } from '../src/flows/learning/learning-flow-research';

describe('learning-flow-research', () => {
  describe('evaluateResearchJob', () => {
    it('scores based on official sources', () => {
      const job = {
        sources: [{ trustClass: 'official' }, { trustClass: 'official' }]
      } as any;
      const result = evaluateResearchJob(job);
      expect(result.score).toBe(40); // 2 * 20
      expect(result.confidence).toBe('medium');
      expect(result.notes[0]).toContain('2 条官方来源');
    });

    it('scores based on curated sources', () => {
      const job = {
        sources: [{ trustClass: 'curated' }, { trustClass: 'curated' }]
      } as any;
      const result = evaluateResearchJob(job);
      expect(result.score).toBe(24); // 2 * 12
      expect(result.confidence).toBe('low'); // 24 < 40
    });

    it('scores based on community sources', () => {
      const job = {
        sources: [{ trustClass: 'community' }]
      } as any;
      const result = evaluateResearchJob(job);
      expect(result.score).toBe(5);
      expect(result.confidence).toBe('low');
    });

    it('scores based on internal sources', () => {
      const job = {
        sources: [{ trustClass: 'internal' }]
      } as any;
      const result = evaluateResearchJob(job);
      expect(result.score).toBe(4);
      expect(result.confidence).toBe('low');
    });

    it('combines scores from multiple source types', () => {
      const job = {
        sources: [
          { trustClass: 'official' },
          { trustClass: 'curated' },
          { trustClass: 'community' },
          { trustClass: 'internal' }
        ]
      } as any;
      const result = evaluateResearchJob(job);
      expect(result.score).toBe(41); // 20 + 12 + 5 + 4
      expect(result.confidence).toBe('medium');
    });

    it('returns high confidence for score >= 70', () => {
      const job = {
        sources: [
          { trustClass: 'official' },
          { trustClass: 'official' },
          { trustClass: 'official' },
          { trustClass: 'official' }
        ]
      } as any;
      const result = evaluateResearchJob(job);
      expect(result.score).toBe(80);
      expect(result.confidence).toBe('high');
    });

    it('handles empty sources', () => {
      const job = { sources: [] } as any;
      const result = evaluateResearchJob(job);
      expect(result.score).toBe(0);
      expect(result.confidence).toBe('low');
      expect(result.notes[0]).toContain('未命中官方来源');
      expect(result.notes[1]).toContain('没有补充 curated');
      expect(result.notes[2]).toContain('没有使用社区来源');
    });

    it('handles undefined sources', () => {
      const job = {} as any;
      const result = evaluateResearchJob(job);
      expect(result.score).toBe(0);
    });

    it('clamps score between 0 and 100', () => {
      const job = {
        sources: Array.from({ length: 20 }, () => ({ trustClass: 'official' }))
      } as any;
      const result = evaluateResearchJob(job);
      expect(result.score).toBe(100);
    });

    it('counts external sources correctly', () => {
      const job = {
        sources: [{ trustClass: 'official' }, { trustClass: 'internal' }, { trustClass: 'curated' }]
      } as any;
      const result = evaluateResearchJob(job);
      expect(result.sourceSummary.externalSourceCount).toBe(2);
      expect(result.sourceSummary.internalSourceCount).toBe(1);
    });
  });

  describe('autoPersistResearchMemory', () => {
    const makeRepo = (conflicts: any[] = []) => ({
      search: vi.fn().mockResolvedValue(conflicts),
      append: vi.fn().mockResolvedValue(undefined)
    });

    it('persists memory when no conflicts and high-confidence policy with high score', async () => {
      const repo = makeRepo();
      const job = {
        id: 'job-1',
        goal: 'learn something',
        summary: 'research summary',
        sources: [{ trustClass: 'official', summary: 'src', sourceUrl: 'https://example.com' }]
      } as any;
      const evaluation = { score: 80, confidence: 'high' };

      const result = await autoPersistResearchMemory(repo as any, job, evaluation as any, 'high-confidence');

      expect(repo.append).toHaveBeenCalledTimes(1);
      expect(result).toHaveLength(1);
      expect(job.autoPersistEligible).toBe(true);
      expect(job.persistedMemoryIds).toHaveLength(1);
    });

    it('skips persistence when conflicts found', async () => {
      const conflicts = [{ id: 'existing-mem', tags: ['research-job'], summary: 'same summary' }];
      const repo = makeRepo(conflicts);
      const job = {
        id: 'job-2',
        goal: 'learn something',
        summary: 'same summary',
        sources: []
      } as any;
      const evaluation = { score: 80, confidence: 'high' };

      const result = await autoPersistResearchMemory(repo as any, job, evaluation as any, 'high-confidence');

      expect(repo.append).not.toHaveBeenCalled();
      expect(result).toHaveLength(0);
      expect(job.conflictDetected).toBe(true);
      expect(job.autoPersistEligible).toBe(false);
    });

    it('skips persistence when policy is manual', async () => {
      const repo = makeRepo();
      const job = { id: 'job-3', goal: 'test', sources: [] } as any;
      const evaluation = { score: 80, confidence: 'high' };

      const result = await autoPersistResearchMemory(repo as any, job, evaluation as any, 'manual');

      expect(repo.append).not.toHaveBeenCalled();
      expect(result).toHaveLength(0);
      expect(job.autoPersistEligible).toBe(false);
    });

    it('skips persistence when confidence is not high', async () => {
      const repo = makeRepo();
      const job = { id: 'job-4', goal: 'test', sources: [] } as any;
      const evaluation = { score: 40, confidence: 'medium' };

      const result = await autoPersistResearchMemory(repo as any, job, evaluation as any, 'high-confidence');

      expect(repo.append).not.toHaveBeenCalled();
      expect(result).toHaveLength(0);
    });

    it('uses fallback summary when job summary is missing', async () => {
      const repo = makeRepo();
      const job = {
        id: 'job-5',
        goal: 'some goal',
        sources: []
      } as any;
      const evaluation = { score: 90, confidence: 'high' };

      await autoPersistResearchMemory(repo as any, job, evaluation as any, 'high-confidence');

      const appended = repo.append.mock.calls[0][0];
      expect(appended.summary).toContain('some goal');
    });
  });
});
