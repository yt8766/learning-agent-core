import { describe, expect, it } from 'vitest';

import { mapMiniMaxError, mapMiniMaxTask } from '../../src';

describe('@agent/adapters MiniMax media mappers', () => {
  it.each([
    ['Preparing', 'queued'],
    ['Queueing', 'queued'],
    ['Processing', 'running'],
    ['Unknown', 'running'],
    ['Success', 'succeeded'],
    ['Fail', 'failed']
  ] as const)('maps MiniMax task status %s to stable media task status %s', (status, expectedStatus) => {
    const task = mapMiniMaxTask({
      taskId: 'task-1',
      kind: 'video',
      providerTaskId: 'mx-task-1',
      status,
      assetRefs: ['asset-video-1'],
      now: '2026-04-27T00:00:00.000Z'
    });

    expect(task.status).toBe(expectedStatus);
    expect(task.provider).toBe('minimax');
  });

  it.each([
    ['rate_limit', true],
    ['timeout', true],
    ['temporarily_unavailable', true],
    ['validation_error', false]
  ] as const)('maps MiniMax error %s retryable=%s', (code, retryable) => {
    const error = mapMiniMaxError({
      code,
      message: 'MiniMax provider error',
      now: '2026-04-27T00:00:00.000Z'
    });

    expect(error.provider).toBe('minimax');
    expect(error.retryable).toBe(retryable);
  });
});
