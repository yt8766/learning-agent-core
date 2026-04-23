import { NotFoundException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import {
  assertTaskActionResult,
  buildRecentTraceSummaryLines
} from '../../../../src/runtime/domain/tasks/runtime-task-service-helpers';

describe('runtime task service helpers', () => {
  it('builds recent trace summary lines for diagnosis follow-up', () => {
    const lines = buildRecentTraceSummaryLines({
      trace: [
        { at: '2026-04-19T10:00:00.000Z', node: 'research', summary: 'start' },
        { at: '2026-04-19T10:01:00.000Z', node: 'review', summary: 'validate' }
      ]
    } as any);

    expect(lines).toEqual([
      '2026-04-19T10:00:00.000Z / research / start',
      '2026-04-19T10:01:00.000Z / review / validate'
    ]);
  });

  it('asserts task action results and throws when the orchestrator returns nothing', () => {
    expect(assertTaskActionResult('task-1', { id: 'task-1', status: 'running' })).toEqual({
      id: 'task-1',
      status: 'running'
    });
    expect(() => assertTaskActionResult('missing-task', undefined)).toThrow(NotFoundException);
  });
});
