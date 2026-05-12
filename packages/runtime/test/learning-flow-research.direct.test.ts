import { describe, expect, it, vi } from 'vitest';

import { evaluateResearchJob, autoPersistResearchMemory } from '../src/flows/learning/learning-flow-research';

function makeJob(overrides: Record<string, unknown> = {}) {
  return {
    id: 'job-1',
    goal: 'research goal',
    summary: 'research summary',
    documentUri: 'https://example.com/doc',
    sources: [],
    workflowId: 'workflow-1',
    conflictDetected: false,
    conflictNotes: [],
    autoPersistEligible: false,
    persistedMemoryIds: [],
    ...overrides
  } as any;
}

describe('learning-flow-research (direct)', () => {
  describe('evaluateResearchJob', () => {
    it('produces evaluation with score based on sources', () => {
      const job = makeJob({
        sources: [
          { trustClass: 'official', summary: 'Official source' },
          { trustClass: 'curated', summary: 'Curated source' },
          { trustClass: 'community', summary: 'Community source' }
        ]
      });
      const evaluation = evaluateResearchJob(job);
      expect(evaluation.score).toBeGreaterThan(0);
      expect(evaluation.confidence).toBeDefined();
      expect(evaluation.notes).toBeDefined();
    });

    it('scores official sources highest', () => {
      const official = makeJob({
        sources: [{ trustClass: 'official', summary: 'Official' }]
      });
      const community = makeJob({
        sources: [{ trustClass: 'community', summary: 'Community' }]
      });
      expect(evaluateResearchJob(official).score).toBeGreaterThan(evaluateResearchJob(community).score);
    });

    it('produces high confidence for high score', () => {
      const job = makeJob({
        sources: [
          { trustClass: 'official', summary: 'Official 1' },
          { trustClass: 'official', summary: 'Official 2' },
          { trustClass: 'official', summary: 'Official 3' },
          { trustClass: 'official', summary: 'Official 4' }
        ]
      });
      const evaluation = evaluateResearchJob(job);
      expect(evaluation.score).toBeGreaterThanOrEqual(70);
      expect(evaluation.confidence).toBe('high');
    });

    it('produces low confidence for low score', () => {
      const job = makeJob({ sources: [] });
      const evaluation = evaluateResearchJob(job);
      expect(evaluation.score).toBe(0);
      expect(evaluation.confidence).toBe('low');
    });

    it('produces medium confidence for mid-range score', () => {
      // curated * 12 = 4 * 12 = 48, which is >= 40 and < 70 -> medium
      const job = makeJob({
        sources: [
          { trustClass: 'curated', summary: 'Curated 1' },
          { trustClass: 'curated', summary: 'Curated 2' },
          { trustClass: 'curated', summary: 'Curated 3' },
          { trustClass: 'curated', summary: 'Curated 4' }
        ]
      });
      const evaluation = evaluateResearchJob(job);
      expect(evaluation.confidence).toBe('medium');
    });

    it('includes notes about source types', () => {
      const job = makeJob({
        sources: [
          { trustClass: 'official', summary: 'Official' },
          { trustClass: 'community', summary: 'Community' }
        ]
      });
      const evaluation = evaluateResearchJob(job);
      expect(evaluation.notes.some(n => n.includes('官方来源'))).toBe(true);
      expect(evaluation.notes.some(n => n.includes('社区来源'))).toBe(true);
    });

    it('includes note about no curated sources', () => {
      const job = makeJob({ sources: [{ trustClass: 'official', summary: 'Official' }] });
      const evaluation = evaluateResearchJob(job);
      expect(evaluation.notes.some(n => n.includes('没有补充 curated'))).toBe(true);
    });

    it('sets sourceSummary correctly', () => {
      const job = makeJob({
        sources: [
          { trustClass: 'official', summary: 'Internal 1' },
          { trustClass: 'internal', summary: 'Internal 2' }
        ]
      });
      const evaluation = evaluateResearchJob(job);
      expect(evaluation.sourceSummary.externalSourceCount).toBe(1);
      expect(evaluation.sourceSummary.internalSourceCount).toBe(1);
    });

    it('clamps score between 0 and 100', () => {
      const job = makeJob({
        sources: Array.from({ length: 20 }, () => ({ trustClass: 'official', summary: 'Official' }))
      });
      const evaluation = evaluateResearchJob(job);
      expect(evaluation.score).toBeLessThanOrEqual(100);
    });
  });

  describe('autoPersistResearchMemory', () => {
    it('returns empty when conflicts detected', async () => {
      const mockRepo = {
        search: vi
          .fn()
          .mockResolvedValue([{ id: 'existing-mem', summary: 'research summary', tags: ['research-job'] }]),
        append: vi.fn()
      } as any;
      const job = makeJob();
      const evaluation = { score: 80, confidence: 'high' } as any;
      const result = await autoPersistResearchMemory(mockRepo, job, evaluation, 'high-confidence');
      expect(result).toEqual([]);
      expect(job.conflictDetected).toBe(true);
      expect(job.autoPersistEligible).toBe(false);
    });

    it('returns empty when policy is manual', async () => {
      const mockRepo = {
        search: vi.fn().mockResolvedValue([]),
        append: vi.fn()
      } as any;
      const job = makeJob();
      const evaluation = { score: 80, confidence: 'high' } as any;
      const result = await autoPersistResearchMemory(mockRepo, job, evaluation, 'manual');
      expect(result).toEqual([]);
      expect(job.autoPersistEligible).toBe(false);
    });

    it('returns empty when confidence is not high', async () => {
      const mockRepo = {
        search: vi.fn().mockResolvedValue([]),
        append: vi.fn()
      } as any;
      const job = makeJob();
      const evaluation = { score: 50, confidence: 'medium' } as any;
      const result = await autoPersistResearchMemory(mockRepo, job, evaluation, 'high-confidence');
      expect(result).toEqual([]);
      expect(job.autoPersistEligible).toBe(false);
    });

    it('persists memory when high confidence and no conflicts', async () => {
      const mockRepo = {
        search: vi.fn().mockResolvedValue([]),
        append: vi.fn()
      } as any;
      const job = makeJob({
        sources: [{ trustClass: 'official', summary: 'Source 1', sourceUrl: 'https://example.com' }]
      });
      const evaluation = { score: 80, confidence: 'high' } as any;
      const result = await autoPersistResearchMemory(mockRepo, job, evaluation, 'high-confidence');
      expect(result).toHaveLength(1);
      expect(job.autoPersistEligible).toBe(true);
      expect(job.persistedMemoryIds).toHaveLength(1);
      expect(mockRepo.append).toHaveBeenCalled();
    });

    it('sets conflictDetected based on summary match', async () => {
      const mockRepo = {
        search: vi.fn().mockResolvedValue([{ id: 'existing', summary: 'research summary', tags: ['other-tag'] }]),
        append: vi.fn()
      } as any;
      const job = makeJob({ summary: 'research summary' });
      const evaluation = { score: 80, confidence: 'high' } as any;
      const result = await autoPersistResearchMemory(mockRepo, job, evaluation, 'high-confidence');
      expect(result).toEqual([]);
      expect(job.conflictDetected).toBe(true);
    });

    it('adds governance warnings when conflict detected', async () => {
      const mockRepo = {
        search: vi
          .fn()
          .mockResolvedValue([{ id: 'existing-mem', summary: 'research summary', tags: ['research-job'] }]),
        append: vi.fn()
      } as any;
      const job = makeJob();
      const evaluation = { score: 80, confidence: 'high', governanceWarnings: [] } as any;
      await autoPersistResearchMemory(mockRepo, job, evaluation, 'high-confidence');
      expect(job.learningEvaluation.governanceWarnings.length).toBeGreaterThan(0);
    });
  });
});
