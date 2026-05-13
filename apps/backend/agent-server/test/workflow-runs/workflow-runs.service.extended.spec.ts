import { describe, expect, it, vi, beforeEach } from 'vitest';

import { WorkflowRunRepository } from '../../src/workflow-runs/repositories/workflow-run.repository';
import { WorkflowDispatcher } from '../../src/workflow-runs/workflow-dispatcher';
import { WorkflowRunService } from '../../src/workflow-runs/workflow-runs.service';

describe('WorkflowRunService extended coverage', () => {
  let service: WorkflowRunService;
  let repository: Partial<WorkflowRunRepository>;
  let dispatcher: Partial<WorkflowDispatcher>;
  let collectedEvents: any[];

  beforeEach(() => {
    collectedEvents = [];
    repository = {
      create: vi.fn().mockResolvedValue({}),
      complete: vi.fn().mockResolvedValue(undefined),
      fail: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn().mockResolvedValue(null),
      findByWorkflowId: vi.fn().mockResolvedValue([]),
      findAll: vi.fn().mockResolvedValue([])
    };
    dispatcher = {
      dispatch: vi.fn().mockResolvedValue({ bundle: {}, trace: [] })
    };
    service = new WorkflowRunService(repository as WorkflowRunRepository, dispatcher as WorkflowDispatcher);
  });

  describe('startRun', () => {
    it('creates a subject and repository entry, then executes async', async () => {
      const runId = await service.startRun('wf-1', { key: 'value' });

      expect(typeof runId).toBe('string');
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ workflowId: 'wf-1', inputData: { key: 'value' } })
      );
    });

    it('streams events from the subject after startRun', async () => {
      const runId = await service.startRun('wf-1', {});
      const events: any[] = [];

      const obs = service.streamRun(runId);
      const sub = obs.subscribe(event => events.push(JSON.parse(event.data)));

      // Wait for async execution to complete
      await new Promise(resolve => setTimeout(resolve, 50));
      sub.unsubscribe();

      expect(events.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('streamRun', () => {
    it('replays from DB when subject is not available (run already finished)', async () => {
      (repository.findById as any).mockResolvedValue({
        id: 'finished-run',
        workflowId: 'wf-1',
        status: 'completed',
        startedAt: 1000,
        completedAt: 2000,
        traceData: [{ nodeId: 'n1', status: 'succeeded', durationMs: 500, inputSnapshot: {}, outputSnapshot: {} }]
      });

      const events: any[] = [];
      const obs = service.streamRun('finished-run');

      await new Promise<void>(resolve => {
        obs.subscribe({
          next: event => events.push(JSON.parse(event.data)),
          complete: resolve
        });
      });

      expect(events.length).toBe(2);
      expect(events[0].type).toBe('node-complete');
      expect(events[1].type).toBe('run-complete');
      expect(events[1].totalMs).toBe(1000);
    });

    it('returns EMPTY when run not found in DB replay', async () => {
      (repository.findById as any).mockResolvedValue(null);

      const events: any[] = [];
      const obs = service.streamRun('missing-run');

      await new Promise<void>(resolve => {
        obs.subscribe({
          next: event => events.push(event),
          complete: resolve
        });
      });

      expect(events).toHaveLength(0);
    });

    it('handles run with no traceData in DB replay', async () => {
      (repository.findById as any).mockResolvedValue({
        id: 'no-trace-run',
        status: 'completed',
        startedAt: 1000,
        completedAt: 1500,
        traceData: null
      });

      const events: any[] = [];
      const obs = service.streamRun('no-trace-run');

      await new Promise<void>(resolve => {
        obs.subscribe({
          next: event => events.push(JSON.parse(event.data)),
          complete: resolve
        });
      });

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('run-complete');
    });
  });

  describe('listRuns', () => {
    it('returns empty array when no runs', async () => {
      const result = await service.listRuns();
      expect(result).toEqual([]);
    });

    it('maps run records to summary objects', async () => {
      (repository.findAll as any).mockResolvedValue([
        {
          id: 'r1',
          workflowId: 'wf-1',
          status: 'completed',
          startedAt: 1000,
          completedAt: 2000,
          inputData: {},
          traceData: null
        }
      ]);

      const result = await service.listRuns();

      expect(result).toEqual([
        { id: 'r1', workflowId: 'wf-1', status: 'completed', startedAt: 1000, completedAt: 2000 }
      ]);
    });
  });

  describe('getRun', () => {
    it('delegates to repository.findById', async () => {
      (repository.findById as any).mockResolvedValue({ id: 'run-1' });

      const result = await service.getRun('run-1');

      expect(repository.findById).toHaveBeenCalledWith('run-1');
      expect(result).toEqual({ id: 'run-1' });
    });
  });

  describe('executeAsync error handling', () => {
    it('emits run-error and calls repository.fail on dispatcher error', async () => {
      let resolveDispatch: () => void;
      (dispatcher.dispatch as any).mockImplementation(
        () =>
          new Promise<void>((resolve, reject) => {
            resolveDispatch = () => reject(new Error('dispatch failed'));
          })
      );

      const runId = await service.startRun('wf-1', {});
      const events: any[] = [];

      const obs = service.streamRun(runId);
      obs.subscribe(event => events.push(JSON.parse(event.data)));

      // Trigger the rejection after subscription is set up
      resolveDispatch!();

      // Wait for the async execution to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(events.some(e => e.type === 'run-error')).toBe(true);
      expect(repository.fail).toHaveBeenCalledWith(runId);
    }, 10000);

    it('handles non-Error thrown from dispatcher', async () => {
      let resolveDispatch: () => void;
      (dispatcher.dispatch as any).mockImplementation(
        () =>
          new Promise<void>((resolve, reject) => {
            resolveDispatch = () => reject('string error');
          })
      );

      const runId = await service.startRun('wf-1', {});
      const events: any[] = [];

      service.streamRun(runId).subscribe(event => events.push(JSON.parse(event.data)));

      resolveDispatch!();
      await new Promise(resolve => setTimeout(resolve, 100));

      const errorEvent = events.find(e => e.type === 'run-error');
      expect(errorEvent?.error).toBe('string error');
    }, 10000);
  });
});
