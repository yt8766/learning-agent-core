import { describe, expect, it } from 'vitest';

import { mapMiniMaxError, mapMiniMaxTask } from '../../src';

describe('@agent/adapters MiniMax media mappers', () => {
  it('maps MiniMax task status to stable media task contract', () => {
    const task = mapMiniMaxTask({
      taskId: 'task-1',
      kind: 'video',
      providerTaskId: 'mx-task-1',
      status: 'Success',
      assetRefs: ['asset-video-1'],
      now: '2026-04-27T00:00:00.000Z'
    });

    expect(task.status).toBe('succeeded');
    expect(task.provider).toBe('minimax');
  });

  it('maps MiniMax errors to retryable provider errors', () => {
    const error = mapMiniMaxError({
      code: 'rate_limit',
      message: 'Too many requests',
      now: '2026-04-27T00:00:00.000Z'
    });

    expect(error.provider).toBe('minimax');
    expect(error.retryable).toBe(true);
  });
});
