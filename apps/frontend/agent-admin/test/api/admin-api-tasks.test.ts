import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getTaskBundle } from '@/api/admin-api-tasks';

const fetchMock = vi.fn();

describe('admin-api-tasks', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('skips the review request while the task is still running', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'task-1',
          status: 'running',
          approvals: [],
          updatedAt: '',
          createdAt: '',
          goal: 'demo'
        })
      })
      .mockResolvedValue({
        ok: true,
        json: async () => []
      });

    await getTaskBundle('task-1');

    const urls = fetchMock.mock.calls.map(call => String(call[0]));
    expect(urls.some(url => url.endsWith('/tasks/task-1/review'))).toBe(false);
  });

  it('requests the review endpoint after the task reaches a terminal state', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'task-1',
          status: 'completed',
          approvals: [],
          updatedAt: '',
          createdAt: '',
          goal: 'demo'
        })
      })
      .mockResolvedValue({
        ok: true,
        json: async () => []
      });

    await getTaskBundle('task-1');

    const urls = fetchMock.mock.calls.map(call => String(call[0]));
    expect(urls.some(url => url.endsWith('/tasks/task-1/review'))).toBe(true);
  });
});
