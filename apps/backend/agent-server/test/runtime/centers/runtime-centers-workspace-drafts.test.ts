import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  createRuntimeWorkspaceDraftStore,
  getRuntimeWorkspaceDraftStoreForContext,
  mapSkillDraftToWorkspaceProjection
} from '../../../src/runtime/centers/runtime-centers-workspace-drafts';
import { resetRuntimeWorkspaceDraftStore } from '../../../src/runtime/centers/runtime-centers-workspace-drafts';

describe('runtime workspace skill draft store', () => {
  const tempRoots: string[] = [];

  afterEach(async () => {
    resetRuntimeWorkspaceDraftStore();
    await Promise.all(tempRoots.map(root => rm(root, { recursive: true, force: true })));
    tempRoots.length = 0;
  });

  it('seeds, lists, approves, and rejects skill-runtime drafts as workspace projections', async () => {
    const store = createRuntimeWorkspaceDraftStore({
      now: () => new Date('2026-04-26T10:00:00.000Z'),
      createId: () => 'skill-draft-seeded'
    });

    const seeded = await store.seedDraft({
      workspaceId: 'workspace-platform',
      title: 'Reuse backend draft approvals',
      description: 'Promote workspace draft decisions through backend governance.',
      triggerHints: ['workspace draft approval'],
      bodyMarkdown: '# Backend draft approval\nApprove or reject skill drafts.',
      requiredTools: ['runtime-centers'],
      requiredConnectors: ['workspace-vault'],
      sourceTaskId: 'task-draft-store',
      source: 'workspace-vault',
      authorId: 'agent-admin-user',
      riskLevel: 'medium',
      confidence: 0.82,
      sourceEvidenceIds: ['evidence-1']
    });

    expect(seeded).toMatchObject({
      draftId: 'skill-draft-seeded',
      status: 'draft',
      title: 'Reuse backend draft approvals',
      summary: 'Promote workspace draft decisions through backend governance.',
      sourceTaskId: 'task-draft-store',
      confidence: 0.82,
      riskLevel: 'medium',
      createdAt: '2026-04-26T10:00:00.000Z',
      updatedAt: '2026-04-26T10:00:00.000Z',
      provenance: {
        sourceKind: 'workspace-draft',
        sourceTaskId: 'task-draft-store',
        sourceEvidenceIds: ['evidence-1']
      }
    });

    await expect(store.listDrafts('workspace-platform')).resolves.toEqual([seeded]);

    const approved = await store.approveDraft('skill-draft-seeded', { reviewerId: 'reviewer-1' });
    expect(approved).toMatchObject({
      draftId: 'skill-draft-seeded',
      status: 'active',
      decidedAt: '2026-04-26T10:00:00.000Z',
      decidedBy: 'reviewer-1'
    });

    const rejectedSeed = await store.seedDraft({
      workspaceId: 'workspace-platform',
      title: 'Reject weak draft',
      bodyMarkdown: '# Weak draft',
      sourceTaskId: 'task-weak-draft',
      source: 'learning-suggestion',
      riskLevel: 'low',
      confidence: 0.4
    });
    const rejected = await store.rejectDraft(rejectedSeed.draftId, {
      reviewerId: 'reviewer-2',
      reason: 'needs stronger evidence'
    });

    expect(rejected).toMatchObject({
      draftId: rejectedSeed.draftId,
      status: 'rejected',
      decidedAt: '2026-04-26T10:00:00.000Z',
      decidedBy: 'reviewer-2'
    });
  });

  it('uses a workspace-root file-backed store for runtime context by default', async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), 'runtime-workspace-drafts-'));
    tempRoots.push(workspaceRoot);
    const ctx = {
      settings: {
        workspaceRoot
      }
    };
    const firstStore = getRuntimeWorkspaceDraftStoreForContext(ctx);

    const seeded = await firstStore.seedDraft({
      workspaceId: 'workspace-platform',
      title: 'Persist backend workspace draft',
      bodyMarkdown: '# Persisted workspace draft',
      sourceTaskId: 'task-persist-draft',
      source: 'workspace-vault',
      riskLevel: 'low',
      confidence: 0.88
    });

    resetRuntimeWorkspaceDraftStore();
    const restartedStore = getRuntimeWorkspaceDraftStoreForContext(ctx);

    await expect(restartedStore.listDrafts('workspace-platform')).resolves.toMatchObject([
      {
        draftId: seeded.draftId,
        title: 'Persist backend workspace draft',
        status: 'draft',
        confidence: 0.88
      }
    ]);
  });

  it('filters workspace drafts by status, source task, source, limit, and cursor offset', async () => {
    const store = createRuntimeWorkspaceDraftStore({
      now: () => new Date('2026-04-26T10:00:00.000Z')
    });

    const first = await store.seedDraft({
      workspaceId: 'workspace-platform',
      title: 'First matching draft',
      bodyMarkdown: '# First',
      sourceTaskId: 'task-query-1',
      source: 'workspace-vault'
    });
    await store.seedDraft({
      workspaceId: 'workspace-platform',
      title: 'Unrelated task draft',
      bodyMarkdown: '# Other task',
      sourceTaskId: 'task-other',
      source: 'workspace-vault'
    });
    await store.seedDraft({
      workspaceId: 'workspace-platform',
      title: 'Manual draft',
      bodyMarkdown: '# Manual',
      sourceTaskId: 'task-query-1',
      source: 'manual'
    });
    const second = await store.seedDraft({
      workspaceId: 'workspace-platform',
      title: 'Second matching draft',
      bodyMarkdown: '# Second',
      sourceTaskId: 'task-query-1',
      source: 'workspace-vault'
    });
    await store.rejectDraft(first.draftId, { reviewerId: 'reviewer-1', reason: 'not this one' });

    await expect(
      store.listDrafts('workspace-platform', {
        status: 'draft',
        sourceTaskId: 'task-query-1',
        source: 'workspace-vault',
        limit: 1,
        cursor: 'MA=='
      })
    ).resolves.toEqual([second]);
  });

  it('maps skill-runtime draft records to workspace-safe projection fields', () => {
    expect(
      mapSkillDraftToWorkspaceProjection({
        id: 'draft-1',
        workspaceId: 'workspace-platform',
        title: 'Draft title',
        description: 'Draft summary',
        triggerHints: ['hint'],
        bodyMarkdown: '# Draft body',
        requiredTools: ['tool'],
        requiredConnectors: ['connector'],
        sourceTaskId: 'task-1',
        source: 'workspace-vault',
        authorId: 'author-1',
        riskLevel: 'high',
        confidence: 0.77,
        sourceEvidenceIds: ['evidence-1'],
        status: 'active',
        reuseStats: { count: 0 },
        approvedBy: 'reviewer-1',
        approvedAt: '2026-04-26T10:01:00.000Z',
        createdAt: '2026-04-26T10:00:00.000Z',
        updatedAt: '2026-04-26T10:01:00.000Z',
        internalMetadata: { providerRaw: 'must-not-leak' }
      } as any)
    ).toEqual({
      draftId: 'draft-1',
      status: 'active',
      title: 'Draft title',
      summary: 'Draft summary',
      sourceTaskId: 'task-1',
      confidence: 0.77,
      riskLevel: 'high',
      createdAt: '2026-04-26T10:00:00.000Z',
      updatedAt: '2026-04-26T10:01:00.000Z',
      decidedAt: '2026-04-26T10:01:00.000Z',
      decidedBy: 'reviewer-1',
      provenance: {
        sourceKind: 'workspace-draft',
        sourceTaskId: 'task-1',
        sourceEvidenceIds: ['evidence-1']
      }
    });
  });
});
