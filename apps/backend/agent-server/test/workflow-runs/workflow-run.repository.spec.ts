import { describe, expect, it, vi, beforeEach } from 'vitest';

import { WorkflowRunRepository } from '../../src/workflow-runs/repositories/workflow-run.repository';

describe('WorkflowRunRepository', () => {
  let repo: WorkflowRunRepository;
  let mockRepo: any;

  beforeEach(() => {
    mockRepo = {
      create: vi.fn().mockImplementation((data: any) => Promise.resolve({ ...data })),
      save: vi.fn().mockImplementation((entity: any) => Promise.resolve(entity)),
      update: vi.fn().mockResolvedValue(undefined),
      findOne: vi.fn().mockResolvedValue(null),
      find: vi.fn().mockResolvedValue([])
    };
    repo = new WorkflowRunRepository(mockRepo);
  });

  describe('create', () => {
    it('creates a run with status running and null completedAt', async () => {
      const result = await repo.create({ id: 'run-1', workflowId: 'wf-1', inputData: { key: 'val' } });

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'run-1',
          workflowId: 'wf-1',
          status: 'running',
          completedAt: null,
          traceData: null
        })
      );
      expect(mockRepo.save).toHaveBeenCalled();
    });
  });

  describe('complete', () => {
    it('updates status to completed with traceData and completedAt', async () => {
      await repo.complete('run-1', [
        { nodeId: 'n1', status: 'succeeded', durationMs: 100, inputSnapshot: {}, outputSnapshot: {} }
      ]);

      expect(mockRepo.update).toHaveBeenCalledWith(
        'run-1',
        expect.objectContaining({
          status: 'completed',
          traceData: expect.any(Array)
        })
      );
    });
  });

  describe('fail', () => {
    it('updates status to failed with completedAt', async () => {
      await repo.fail('run-1');

      expect(mockRepo.update).toHaveBeenCalledWith(
        'run-1',
        expect.objectContaining({
          status: 'failed'
        })
      );
    });
  });

  describe('findById', () => {
    it('returns null when not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      const result = await repo.findById('missing');
      expect(result).toBeNull();
    });

    it('returns the run when found', async () => {
      mockRepo.findOne.mockResolvedValue({ id: 'run-1', workflowId: 'wf-1' });
      const result = await repo.findById('run-1');
      expect(result).toEqual({ id: 'run-1', workflowId: 'wf-1' });
      expect(mockRepo.findOne).toHaveBeenCalledWith({ where: { id: 'run-1' } });
    });
  });

  describe('findByWorkflowId', () => {
    it('uses default limit of 20', async () => {
      await repo.findByWorkflowId('wf-1');

      expect(mockRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { workflowId: 'wf-1' },
          take: 20
        })
      );
    });

    it('uses custom limit when provided', async () => {
      await repo.findByWorkflowId('wf-1', 5);

      expect(mockRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 5
        })
      );
    });
  });

  describe('findAll', () => {
    it('uses default limit of 50', async () => {
      await repo.findAll();

      expect(mockRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 50
        })
      );
    });

    it('uses custom limit when provided', async () => {
      await repo.findAll(10);

      expect(mockRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10
        })
      );
    });
  });
});
