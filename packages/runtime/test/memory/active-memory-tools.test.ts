import { describe, expect, it } from 'vitest';

import {
  archivalMemorySearchByParams,
  coreMemoryAppend,
  coreMemoryReplace
} from '../../src/memory/active-memory-tools';

describe('active-memory-tools', () => {
  it('appends and replaces bounded core memory entries', () => {
    const appended = coreMemoryAppend(
      [],
      {
        action: 'core_memory_append',
        entry: {
          kind: 'task-constraint',
          scopeType: 'task',
          summary: '需要双签审批',
          memoryType: 'constraint'
        }
      },
      { now: '2026-04-16T00:00:00.000Z', maxEntries: 4 }
    );

    const replaced = coreMemoryReplace(
      appended,
      {
        action: 'core_memory_replace',
        targetKind: 'task-constraint',
        auditReason: 'user corrected approval policy',
        entry: {
          kind: 'task-constraint',
          scopeType: 'task',
          summary: '需要人工单签审批',
          memoryType: 'constraint'
        }
      },
      { now: '2026-04-16T00:01:00.000Z', maxEntries: 4 }
    );

    expect(appended).toHaveLength(1);
    expect(replaced).toHaveLength(1);
    expect(replaced[0]).toMatchObject({
      summary: '需要人工单签审批',
      auditReason: 'user corrected approval policy',
      updatedAt: '2026-04-16T00:01:00.000Z'
    });
  });

  it('wraps runtime search params as archival_memory_search', async () => {
    const search = async (request: unknown) =>
      ({
        request,
        coreMemories: [],
        archivalMemories: [],
        rules: [],
        reflections: [],
        reasons: []
      }) as any;

    const result = await archivalMemorySearchByParams({ search } as any, {
      query: 'deploy preference',
      limit: 3,
      actorRole: 'research',
      scopeType: 'task',
      allowedScopeTypes: ['task', 'workspace'],
      taskId: 'task-1',
      memoryTypes: ['preference'],
      includeRules: true,
      includeReflections: false
    });

    expect(result?.request).toMatchObject({
      query: 'deploy preference',
      limit: 3,
      scopeContext: {
        actorRole: 'research',
        scopeType: 'task',
        allowedScopeTypes: ['task', 'workspace']
      },
      entityContext: [{ entityType: 'project', entityId: 'task-1' }]
    });
  });
});
