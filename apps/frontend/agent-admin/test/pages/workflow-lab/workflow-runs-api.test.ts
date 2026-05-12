import { beforeEach, describe, expect, it, vi } from 'vitest';

const { requestMock } = vi.hoisted(() => ({
  requestMock: vi.fn()
}));

vi.mock('@/api/admin-api-core', () => ({
  request: requestMock
}));

import { getWorkflowRun, listWorkflowRuns, startWorkflowRun } from '@/pages/workflow-lab/api/workflow-runs.api';

describe('workflow-runs.api', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    requestMock.mockReset();
  });

  describe('startWorkflowRun', () => {
    it('posts workflow run with correct body', async () => {
      requestMock.mockResolvedValueOnce({ runId: 'run-1' });

      const result = await startWorkflowRun({
        workflowId: 'wf-1',
        input: { prompt: 'test' }
      });

      expect(requestMock).toHaveBeenCalledWith('/workflow-runs', {
        method: 'POST',
        body: JSON.stringify({ workflowId: 'wf-1', input: { prompt: 'test' } })
      });
      expect(result).toEqual({ runId: 'run-1' });
    });
  });

  describe('listWorkflowRuns', () => {
    it('lists all runs without filter', async () => {
      requestMock.mockResolvedValueOnce([{ id: 'run-1' }]);

      const result = await listWorkflowRuns();

      expect(requestMock).toHaveBeenCalledWith('/workflow-runs');
      expect(result).toEqual([{ id: 'run-1' }]);
    });

    it('lists runs filtered by workflow ID', async () => {
      requestMock.mockResolvedValueOnce([{ id: 'run-1' }]);

      await listWorkflowRuns('wf-1');

      expect(requestMock).toHaveBeenCalledWith('/workflow-runs?workflowId=wf-1');
    });

    it('encodes workflow ID in query string', async () => {
      requestMock.mockResolvedValueOnce([]);

      await listWorkflowRuns('wf/special');

      expect(requestMock).toHaveBeenCalledWith('/workflow-runs?workflowId=wf%2Fspecial');
    });
  });

  describe('getWorkflowRun', () => {
    it('fetches run detail by ID', async () => {
      const detail = {
        id: 'run-1',
        workflowId: 'wf-1',
        status: 'completed',
        startedAt: 1000,
        completedAt: 2000,
        inputData: { prompt: 'test' },
        traceData: []
      };
      requestMock.mockResolvedValueOnce(detail);

      const result = await getWorkflowRun('run-1');

      expect(requestMock).toHaveBeenCalledWith('/workflow-runs/run-1');
      expect(result).toEqual(detail);
    });
  });
});
