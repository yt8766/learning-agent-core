import { describe, expect, it, vi } from 'vitest';

vi.mock('@agent/config', () => ({
  loadSettings: vi.fn().mockReturnValue({ policy: { sourcePolicyMode: 'controlled-first' } })
}));

vi.mock('../../../../../src/bridges/supervisor-runtime-bridge', () => ({
  resolveWorkflowPreset: vi.fn().mockReturnValue({
    normalizedGoal: 'test goal',
    preset: {
      id: 'general',
      displayName: '通用协作',
      sourcePolicy: { mode: 'controlled-first' },
      autoPersistPolicy: { memory: 'manual' }
    }
  }),
  buildResearchSourcePlan: vi.fn().mockReturnValue([
    { sourceUrl: 'https://github.com/test', trustClass: 'high', sourceType: 'repo' },
    { sourceUrl: 'https://example.com', trustClass: 'medium', sourceType: 'web' }
  ])
}));

vi.mock('../../../../../src/flows/learning', () => ({
  LearningFlow: vi.fn().mockImplementation(() => ({
    evaluateResearchJob: vi.fn().mockReturnValue({ score: 80, notes: ['good'] }),
    autoPersistResearchMemory: vi.fn().mockResolvedValue(undefined)
  }))
}));

import { MainGraphLearningJobsRuntime } from '../../../../../src/graphs/main/runtime/background/main-graph-learning-jobs';

function makeLearningJobsRuntime(overrides: Record<string, any> = {}) {
  const settings = { policy: { sourcePolicyMode: 'controlled-first' } } as any;
  const learningJobs = new Map<string, any>();
  const learningFlow = {
    evaluateResearchJob: vi.fn().mockReturnValue({ score: 80, notes: ['good'] }),
    autoPersistResearchMemory: vi.fn().mockResolvedValue(undefined)
  } as any;
  const skillRegistry = { publishToLab: vi.fn().mockResolvedValue(undefined) } as any;
  const mcpClientManager = {
    hasCapability: vi.fn().mockReturnValue(false),
    invokeCapability: vi.fn().mockResolvedValue({ ok: true, rawOutput: { data: 'test' } })
  } as any;
  const buildSkillDraft = vi.fn().mockReturnValue({ id: 'skill-1', name: 'draft' });
  const persistRuntimeState = vi.fn().mockResolvedValue(undefined);

  return new MainGraphLearningJobsRuntime(
    settings,
    learningJobs,
    learningFlow,
    skillRegistry,
    mcpClientManager,
    buildSkillDraft,
    persistRuntimeState
  );
}

describe('MainGraphLearningJobsRuntime', () => {
  describe('getLearningJob', () => {
    it('returns undefined for missing job', () => {
      const runtime = makeLearningJobsRuntime();
      expect(runtime.getLearningJob('missing')).toBeUndefined();
    });
  });

  describe('listLearningJobs', () => {
    it('returns empty array when no jobs', () => {
      const runtime = makeLearningJobsRuntime();
      expect(runtime.listLearningJobs()).toEqual([]);
    });
  });

  describe('createDocumentLearningJob', () => {
    it('creates a document learning job', async () => {
      const runtime = makeLearningJobsRuntime();
      const job = await runtime.createDocumentLearningJob({
        documentUri: 'https://example.com/doc.pdf',
        title: 'Test Document'
      } as any);

      expect(job.sourceType).toBe('document');
      expect(job.status).toBe('queued');
      expect(job.documentUri).toBe('https://example.com/doc.pdf');
      expect(job.summary).toBe('Test Document');
    });

    it('uses default summary when title is not provided', async () => {
      const runtime = makeLearningJobsRuntime();
      const job = await runtime.createDocumentLearningJob({
        documentUri: 'https://example.com/doc.pdf'
      } as any);

      expect(job.summary).toContain('Document learning job queued');
    });
  });

  describe('createResearchLearningJob', () => {
    it('creates a research learning job', async () => {
      const runtime = makeLearningJobsRuntime();
      const job = await runtime.createResearchLearningJob({
        goal: 'research AI trends'
      } as any);

      expect(job.sourceType).toBe('research');
      expect(job.status).toBe('queued');
      expect(job.goal).toBe('test goal');
    });

    it('uses title when provided', async () => {
      const runtime = makeLearningJobsRuntime();
      const job = await runtime.createResearchLearningJob({
        goal: 'research AI',
        title: 'Custom Title'
      } as any);

      expect(job.summary).toBe('Custom Title');
    });
  });

  describe('processQueuedLearningJobs', () => {
    it('returns empty when no queued jobs', async () => {
      const runtime = makeLearningJobsRuntime();
      const result = await runtime.processQueuedLearningJobs();
      expect(result).toEqual([]);
    });

    it('processes a document learning job', async () => {
      const runtime = makeLearningJobsRuntime();
      await runtime.createDocumentLearningJob({
        documentUri: 'https://example.com/doc.pdf',
        title: 'Test'
      } as any);

      const result = await runtime.processQueuedLearningJobs(1);
      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('completed');
    });

    it('processes a research learning job', async () => {
      const runtime = makeLearningJobsRuntime();
      await runtime.createResearchLearningJob({ goal: 'research trends' } as any);

      const result = await runtime.processQueuedLearningJobs(1);
      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('completed');
    });

    it('marks job as failed when processing throws', async () => {
      const runtime = makeLearningJobsRuntime();
      // Create a job manually to force an error during processing
      const learningJobs = new Map<string, any>();
      const settings = { policy: { sourcePolicyMode: 'controlled-first' } } as any;
      const learningFlow = {
        evaluateResearchJob: vi.fn(),
        autoPersistResearchMemory: vi.fn()
      } as any;
      const skillRegistry = { publishToLab: vi.fn().mockRejectedValue(new Error('publish failed')) } as any;
      const buildSkillDraft = vi.fn().mockReturnValue({ id: 'skill-1' });
      const persistRuntimeState = vi.fn().mockResolvedValue(undefined);

      const failingRuntime = new MainGraphLearningJobsRuntime(
        settings,
        learningJobs,
        learningFlow,
        skillRegistry,
        undefined as any,
        buildSkillDraft,
        persistRuntimeState
      );

      await failingRuntime.createDocumentLearningJob({
        documentUri: 'https://example.com/doc.pdf',
        title: 'Test'
      } as any);

      const result = await failingRuntime.processQueuedLearningJobs(1);
      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('failed');
      expect(result[0].summary).toBe('publish failed');
    });

    it('processes multiple jobs respecting maxItems', async () => {
      const settings = { policy: { sourcePolicyMode: 'controlled-first' } } as any;
      const learningJobs = new Map<string, any>();
      const learningFlow = {
        evaluateResearchJob: vi.fn().mockReturnValue({ score: 80 }),
        autoPersistResearchMemory: vi.fn().mockResolvedValue(undefined)
      } as any;
      const skillRegistry = { publishToLab: vi.fn().mockResolvedValue(undefined) } as any;
      const buildSkillDraft = vi.fn().mockReturnValue({ id: 'skill-1' });
      const persistRuntimeState = vi.fn().mockResolvedValue(undefined);
      const runtime = new MainGraphLearningJobsRuntime(
        settings,
        learningJobs,
        learningFlow,
        skillRegistry,
        undefined as any,
        buildSkillDraft,
        persistRuntimeState
      );

      // Manually insert jobs with distinct IDs to avoid Date.now() collision
      learningJobs.set('learn_1', {
        id: 'learn_1',
        sourceType: 'document',
        status: 'queued',
        summary: 'Job 1',
        documentUri: 'doc1.pdf',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z'
      });
      learningJobs.set('learn_2', {
        id: 'learn_2',
        sourceType: 'document',
        status: 'queued',
        summary: 'Job 2',
        documentUri: 'doc2.pdf',
        createdAt: '2026-01-01T00:00:01.000Z',
        updatedAt: '2026-01-01T00:00:01.000Z'
      });
      learningJobs.set('learn_3', {
        id: 'learn_3',
        sourceType: 'document',
        status: 'queued',
        summary: 'Job 3',
        documentUri: 'doc3.pdf',
        createdAt: '2026-01-01T00:00:02.000Z',
        updatedAt: '2026-01-01T00:00:02.000Z'
      });

      const result = await runtime.processQueuedLearningJobs(2);
      expect(result).toHaveLength(2);
      expect(result.every(j => j.status === 'completed')).toBe(true);
    });
  });
});
