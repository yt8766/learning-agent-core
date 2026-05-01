import { describe, expect, it } from 'vitest';

import {
  filterWorkspaceSkillDraftsByQuery,
  loadWorkspaceSkillReuseRecords,
  resolveWorkspaceCenterStatus,
  resolveSessionTaskIds
} from '../../../src/runtime/centers/runtime-centers-workspace-query';

describe('runtime-centers workspace query helpers', () => {
  it('loads workspace skill reuse records for the requested workspace sorted by newest reuse time', async () => {
    const records = await loadWorkspaceSkillReuseRecords(
      {
        load: async () => ({
          workspaceSkillReuseRecords: [
            {
              id: 'reuse-old',
              workspaceId: 'workspace-platform',
              skillId: 'skill-old',
              reusedBy: { id: 'agent-1', label: 'Agent 1', kind: 'agent' },
              taskId: 'task-old',
              outcome: 'succeeded',
              reusedAt: '2026-04-26T09:00:00.000Z'
            },
            {
              id: 'reuse-other-workspace',
              workspaceId: 'workspace-other',
              skillId: 'skill-other',
              reusedBy: { id: 'agent-2', label: 'Agent 2', kind: 'agent' },
              taskId: 'task-other',
              outcome: 'succeeded',
              reusedAt: '2026-04-26T12:00:00.000Z'
            },
            {
              id: 'reuse-new',
              workspaceId: 'workspace-platform',
              skillId: 'skill-new',
              reusedBy: { id: 'agent-3', label: 'Agent 3', kind: 'agent' },
              taskId: 'task-new',
              outcome: 'succeeded',
              reusedAt: '2026-04-26T11:00:00.000Z'
            }
          ]
        })
      } as any,
      'workspace-platform'
    );

    expect(records.map(record => record.id)).toEqual(['reuse-new', 'reuse-old']);
  });

  it('returns an empty reuse record list when no runtime state repository is available', async () => {
    await expect(loadWorkspaceSkillReuseRecords(undefined, 'workspace-platform')).resolves.toEqual([]);
  });

  it('resolves non-empty task ids for the requested session only', () => {
    const taskIds = resolveSessionTaskIds(
      {
        listTasks: () => [
          { id: 'task-a', sessionId: 'session-a' },
          { id: '', sessionId: 'session-a' },
          { id: undefined, sessionId: 'session-a' },
          { id: 'task-b', sessionId: 'session-b' }
        ]
      } as any,
      'session-a'
    );

    expect(taskIds).toEqual(new Set(['task-a']));
    expect(resolveSessionTaskIds(undefined, undefined)).toBeUndefined();
  });

  it('filters projected workspace skill drafts by source ids, status, source task and session task ids', () => {
    const drafts = [
      {
        draftId: 'draft-session-a',
        status: 'draft',
        title: 'Session A draft',
        summary: 'Session A draft',
        sourceTaskId: 'task-session-a',
        createdAt: '2026-04-30T09:00:00.000Z',
        updatedAt: '2026-04-30T09:00:00.000Z'
      },
      {
        draftId: 'draft-other-source',
        status: 'draft',
        title: 'Other source draft',
        summary: 'Other source draft',
        sourceTaskId: 'task-session-a',
        createdAt: '2026-04-30T09:01:00.000Z',
        updatedAt: '2026-04-30T09:01:00.000Z'
      },
      {
        draftId: 'draft-session-b',
        status: 'draft',
        title: 'Session B draft',
        summary: 'Session B draft',
        sourceTaskId: 'task-session-b',
        createdAt: '2026-04-30T09:02:00.000Z',
        updatedAt: '2026-04-30T09:02:00.000Z'
      },
      {
        draftId: 'active-session-a',
        status: 'active',
        title: 'Active Session A draft',
        summary: 'Active Session A draft',
        sourceTaskId: 'task-session-a',
        createdAt: '2026-04-30T09:03:00.000Z',
        updatedAt: '2026-04-30T09:03:00.000Z'
      }
    ];

    expect(
      filterWorkspaceSkillDraftsByQuery(drafts, {
        query: {
          status: 'draft',
          sourceTaskId: 'task-session-a'
        },
        sourceDraftIds: new Set(['draft-session-a', 'draft-session-b']),
        sessionTaskIds: new Set(['task-session-a'])
      }).map(draft => draft.draftId)
    ).toEqual(['draft-session-a']);
  });

  it('excludes workspace skill drafts when a session filter resolves to no task ids', () => {
    const drafts = [
      {
        draftId: 'draft-with-task',
        status: 'draft',
        title: 'Draft with task',
        summary: 'Draft with task',
        sourceTaskId: 'task-a',
        createdAt: '2026-04-30T09:00:00.000Z',
        updatedAt: '2026-04-30T09:00:00.000Z'
      },
      {
        draftId: 'draft-without-task',
        status: 'draft',
        title: 'Draft without task',
        summary: 'Draft without task',
        createdAt: '2026-04-30T09:01:00.000Z',
        updatedAt: '2026-04-30T09:01:00.000Z'
      }
    ];

    expect(
      filterWorkspaceSkillDraftsByQuery(drafts, {
        sessionTaskIds: new Set()
      })
    ).toEqual([]);
  });

  it('keeps source draft id filtering active even when no other draft query fields are present', () => {
    const drafts = [
      {
        draftId: 'draft-source-a',
        status: 'active',
        title: 'Source A draft',
        summary: 'Source A draft',
        createdAt: '2026-04-30T09:00:00.000Z',
        updatedAt: '2026-04-30T09:00:00.000Z'
      },
      {
        draftId: 'draft-source-b',
        status: 'draft',
        title: 'Source B draft',
        summary: 'Source B draft',
        createdAt: '2026-04-30T09:01:00.000Z',
        updatedAt: '2026-04-30T09:01:00.000Z'
      }
    ];

    expect(
      filterWorkspaceSkillDraftsByQuery(drafts, {
        sourceDraftIds: new Set(['draft-source-b'])
      }).map(draft => draft.draftId)
    ).toEqual(['draft-source-b']);
  });

  it('normalizes task statuses for the workspace center envelope', () => {
    expect(resolveWorkspaceCenterStatus(undefined)).toBe('idle');
    expect(resolveWorkspaceCenterStatus('running')).toBe('running');
    expect(resolveWorkspaceCenterStatus('waiting_approval')).toBe('waiting_approval');
    expect(resolveWorkspaceCenterStatus('failed')).toBe('failed');
    expect(resolveWorkspaceCenterStatus('cancelled')).toBe('canceled');
    expect(resolveWorkspaceCenterStatus('canceled')).toBe('canceled');
    expect(resolveWorkspaceCenterStatus('completed')).toBe('completed');
    expect(resolveWorkspaceCenterStatus('requires_approval')).toBe('idle');
    expect(resolveWorkspaceCenterStatus('unknown')).toBe('idle');
  });
});
