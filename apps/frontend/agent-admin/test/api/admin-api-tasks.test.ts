import { beforeEach, describe, expect, it, vi } from 'vitest';

const { requestMock } = vi.hoisted(() => ({
  requestMock: vi.fn()
}));

vi.mock('@/api/admin-api-core', () => ({
  request: requestMock
}));

import { getTaskBundle } from '@/api/admin-api-tasks';

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
});
