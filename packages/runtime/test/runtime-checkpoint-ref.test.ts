import { describe, expect, it } from 'vitest';

import { buildCheckpointRef } from '../src/runtime/runtime-checkpoint-ref';

describe('runtime checkpoint ref', () => {
  it('builds a checkpoint ref from session coordinator snapshots', () => {
    const ref = buildCheckpointRef(
      {
        getCheckpoint: () =>
          ({ taskId: 'task-1', checkpointId: 'checkpoint-1', traceCursor: 3, recoverability: 'partial' }) as any
      } as any,
      'session-1'
    );

    expect(ref).toEqual(
      expect.objectContaining({
        sessionId: 'session-1',
        taskId: 'task-1',
        checkpointId: 'checkpoint-1',
        checkpointCursor: 3,
        recoverability: 'partial'
      })
    );
  });
});
