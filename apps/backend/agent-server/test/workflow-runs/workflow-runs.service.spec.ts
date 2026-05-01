import { vi } from 'vitest';

import { WorkflowRunRepository } from '../../src/workflow-runs/repositories/workflow-run.repository';
import { WorkflowDispatcher } from '../../src/workflow-runs/workflow-dispatcher';
import { WorkflowRunService } from '../../src/workflow-runs/workflow-runs.service';

describe('WorkflowRunService', () => {
  let service: WorkflowRunService;
  let repository: Partial<WorkflowRunRepository>;
  let dispatcher: Partial<WorkflowDispatcher>;

  beforeEach(() => {
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

  it('startRun creates a run record and returns a runId string', async () => {
    const runId = await service.startRun('company-live', { briefId: 'b1', targetPlatform: 'douyin' });

    expect(typeof runId).toBe('string');
    expect(runId.length).toBeGreaterThan(0);
    expect(repository.create).toHaveBeenCalledWith(expect.objectContaining({ workflowId: 'company-live' }));
  });

  it('listRuns delegates to repository.findAll when no workflowId', async () => {
    await service.listRuns();

    expect(repository.findAll).toHaveBeenCalled();
  });

  it('listRuns delegates to repository.findByWorkflowId when workflowId provided', async () => {
    await service.listRuns('company-live');

    expect(repository.findByWorkflowId).toHaveBeenCalledWith('company-live');
  });

  it('streamRun returns observable for existing runId', () => {
    const obs = service.streamRun('non-existent-run');

    expect(obs).toBeDefined();
    expect(typeof obs.subscribe).toBe('function');
  });
});
