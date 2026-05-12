import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { WorkflowRunsController } from '../../src/workflow-runs/workflow-runs.controller';

describe('WorkflowRunsController', () => {
  const createController = () => {
    const service = {
      startRun: vi.fn().mockResolvedValue('run-1'),
      listRuns: vi.fn().mockResolvedValue([{ id: 'run-1' }]),
      getRun: vi.fn().mockResolvedValue(null),
      streamRun: vi.fn().mockReturnValue({ subscribe: vi.fn() })
    };
    const controller = new WorkflowRunsController(service as never);
    return { controller, service };
  };

  it('startRun creates a run and returns the runId', async () => {
    const { controller, service } = createController();

    const result = await controller.startRun({ workflowId: 'wf-1', input: { key: 'value' } });

    expect(result).toEqual({ runId: 'run-1' });
    expect(service.startRun).toHaveBeenCalledWith('wf-1', { key: 'value' });
  });

  it('listRuns delegates to service without workflowId', async () => {
    const { controller, service } = createController();

    const result = await controller.listRuns();

    expect(result).toEqual([{ id: 'run-1' }]);
    expect(service.listRuns).toHaveBeenCalledWith(undefined);
  });

  it('listRuns delegates to service with workflowId', async () => {
    const { controller, service } = createController();

    await controller.listRuns('wf-1');

    expect(service.listRuns).toHaveBeenCalledWith('wf-1');
  });

  it('getRun returns the run when found', async () => {
    const { controller, service } = createController();
    service.getRun.mockResolvedValue({ id: 'run-1', status: 'completed' });

    const result = await controller.getRun('run-1');

    expect(result).toEqual({ id: 'run-1', status: 'completed' });
  });

  it('getRun throws NotFoundException when run not found', async () => {
    const { controller } = createController();

    await expect(controller.getRun('missing')).rejects.toThrow(NotFoundException);
  });

  it('streamRun delegates to service', () => {
    const { controller, service } = createController();

    controller.streamRun('run-1');

    expect(service.streamRun).toHaveBeenCalledWith('run-1');
  });
});
