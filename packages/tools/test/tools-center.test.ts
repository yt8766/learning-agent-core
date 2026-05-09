import { describe, expect, it } from 'vitest';

import { buildToolsCenter } from '@agent/runtime';
import { createDefaultToolRegistry } from '../src';

describe('buildToolsCenter', () => {
  it('groups the tool catalog by family and surfaces blocked governance state', () => {
    const center = buildToolsCenter({
      toolRegistry: createDefaultToolRegistry(),
      tasks: [
        {
          id: 'task-1',
          status: 'waiting_approval',
          currentMinistry: 'gongbu-code',
          updatedAt: '2026-03-29T10:00:00.000Z',
          pendingApproval: {
            toolName: 'patch_local_file',
            reason: '需要人工确认 patch',
            riskLevel: 'high'
          },
          agentStates: [{ role: 'executor', toolCalls: ['tool:read_local_file'] }]
        } as never
      ]
    });

    expect(center.families).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'filesystem', toolCount: expect.any(Number) })])
    );
    expect(center.blockedReasons).toEqual(
      expect.arrayContaining([expect.objectContaining({ toolName: 'patch_local_file', status: 'blocked' })])
    );
  });
});
