import { beforeEach, describe, expect, it, vi } from 'vitest';

const { requestMock } = vi.hoisted(() => ({
  requestMock: vi.fn()
}));

vi.mock('@/api/admin-api-core', () => ({
  request: requestMock
}));

import {
  getTaskBundle,
  createTask,
  createAgentDiagnosisTask,
  retryTask,
  approveTask,
  rejectTask
} from '@/api/admin-api-tasks';

describe('admin-api-tasks', () => {
  beforeEach(() => {
    requestMock.mockReset();
  });

  it('skips the review request while the task is still running', async () => {
    requestMock
      .mockResolvedValueOnce({
        id: 'task-1',
        status: 'running',
        approvals: [],
        updatedAt: '',
        createdAt: '',
        goal: 'demo'
      })
      .mockResolvedValue([]);

    await getTaskBundle('task-1');

    const urls = requestMock.mock.calls.map(call => String(call[0]));
    expect(urls).toContain('/tasks/task-1');
    expect(urls.some(url => url.endsWith('/tasks/task-1/review'))).toBe(false);
  });

  it('requests the review endpoint after the task reaches a terminal state', async () => {
    requestMock
      .mockResolvedValueOnce({
        id: 'task-1',
        status: 'completed',
        approvals: [],
        updatedAt: '',
        createdAt: '',
        goal: 'demo'
      })
      .mockResolvedValue([]);

    await getTaskBundle('task-1');

    const urls = requestMock.mock.calls.map(call => String(call[0]));
    expect(urls.some(url => url.endsWith('/tasks/task-1/review'))).toBe(true);
  });

  it('requests review for failed status', async () => {
    requestMock.mockResolvedValueOnce({ id: 'task-1', status: 'failed', goal: 'test' }).mockResolvedValue(undefined);

    await getTaskBundle('task-1');

    const urls = requestMock.mock.calls.map(call => String(call[0]));
    expect(urls.some(url => url.endsWith('/tasks/task-1/review'))).toBe(true);
  });

  it('requests review for cancelled status', async () => {
    requestMock.mockResolvedValueOnce({ id: 'task-1', status: 'cancelled', goal: 'test' }).mockResolvedValue(undefined);

    await getTaskBundle('task-1');

    const urls = requestMock.mock.calls.map(call => String(call[0]));
    expect(urls.some(url => url.endsWith('/tasks/task-1/review'))).toBe(true);
  });

  it('handles failed sub-requests gracefully', async () => {
    requestMock
      .mockResolvedValueOnce({ id: 'task-1', status: 'completed', goal: 'test' })
      .mockRejectedValueOnce(new Error('plan not found'))
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(new Error('review not found'))
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(new Error('audit not found'));

    const result = await getTaskBundle('task-1');

    expect(result.task.id).toBe('task-1');
    expect(result.plan).toBeUndefined();
    expect(result.agents).toEqual([]);
  });

  it('creates task with string goal', async () => {
    requestMock.mockResolvedValueOnce({ id: 'task-1', goal: 'test goal' });

    const result = await createTask('test goal');

    expect(requestMock).toHaveBeenCalledWith('/tasks', {
      method: 'POST',
      body: JSON.stringify({ goal: 'test goal' })
    });
    expect(result.id).toBe('task-1');
  });

  it('creates task with CreateTaskDto', async () => {
    requestMock.mockResolvedValueOnce({ id: 'task-1' });
    const dto = { goal: 'test', modelId: 'gpt-4' };

    await createTask(dto);

    expect(requestMock).toHaveBeenCalledWith('/tasks', {
      method: 'POST',
      body: JSON.stringify(dto)
    });
  });

  it('creates agent diagnosis task', async () => {
    requestMock.mockResolvedValueOnce({ id: 'task-diag' });
    const dto = {
      taskId: 'task-1',
      errorCode: 'ERR_001',
      message: 'Something failed',
      goal: 'Fix it',
      ministry: 'coder',
      diagnosisHint: 'Check logs',
      recommendedAction: 'Retry',
      recoveryPlaybook: ['step1', 'step2'],
      stack: 'Error at line 10'
    };

    const result = await createAgentDiagnosisTask(dto);

    expect(requestMock).toHaveBeenCalledWith('/tasks/diagnosis', {
      method: 'POST',
      body: JSON.stringify(dto)
    });
    expect(result.id).toBe('task-diag');
  });

  it('retries task', async () => {
    requestMock.mockResolvedValueOnce({ id: 'task-1', status: 'running' });

    const result = await retryTask('task-1');

    expect(requestMock).toHaveBeenCalledWith('/tasks/task-1/retry', { method: 'POST' });
    expect(result.id).toBe('task-1');
  });

  it('approves task with intent', async () => {
    requestMock.mockResolvedValueOnce({ id: 'task-1', status: 'running' });

    const result = await approveTask('task-1', 'approve_continue');

    expect(requestMock).toHaveBeenCalledWith('/tasks/task-1/approve', {
      method: 'POST',
      body: JSON.stringify({ intent: 'approve_continue', actor: 'agent-admin-user' })
    });
    expect(result.id).toBe('task-1');
  });

  it('rejects task with intent', async () => {
    requestMock.mockResolvedValueOnce({ id: 'task-1', status: 'cancelled' });

    const result = await rejectTask('task-1', 'reject_cancel');

    expect(requestMock).toHaveBeenCalledWith('/tasks/task-1/reject', {
      method: 'POST',
      body: JSON.stringify({ intent: 'reject_cancel', actor: 'agent-admin-user' })
    });
    expect(result.id).toBe('task-1');
  });
});
