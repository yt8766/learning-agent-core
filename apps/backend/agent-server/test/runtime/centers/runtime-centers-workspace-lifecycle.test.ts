import { describe, expect, it } from 'vitest';

import { attachSkillDraftInstallSummaries } from '../../../src/runtime/centers/runtime-centers-workspace-lifecycle';

describe('runtime-centers workspace lifecycle helpers', () => {
  it('attaches the latest matching workspace draft receipt without leaking raw install fields', () => {
    const [draft] = attachSkillDraftInstallSummaries(
      [
        {
          draftId: 'draft-1',
          status: 'active',
          title: 'Reusable draft',
          summary: 'A skill draft ready for install.',
          sourceTaskId: 'task-1',
          provenance: {
            sourceKind: 'workspace-draft',
            sourceTaskId: 'task-1',
            sourceEvidenceIds: ['evidence-1']
          },
          createdAt: '2026-04-26T00:00:00.000Z',
          updatedAt: '2026-04-26T00:00:00.000Z'
        }
      ] as any,
      [
        {
          id: 'receipt-old',
          skillId: 'workspace-draft-draft-1',
          sourceId: 'workspace-skill-drafts',
          version: '20260426000100',
          status: 'installed',
          phase: 'installed',
          installedAt: '2026-04-26T00:01:00.000Z',
          downloadRef: '/tmp/raw-old/SKILL.md'
        },
        {
          id: 'receipt-latest',
          skillId: 'workspace-draft-draft-1',
          sourceDraftId: 'draft-1',
          sourceId: 'workspace-skill-drafts',
          version: '20260426000300',
          status: 'installed',
          phase: 'installed',
          installedAt: '2026-04-26T00:03:00.000Z',
          failureDetail: 'raw detail must not leak'
        }
      ] as any
    );

    expect(draft).toMatchObject({
      install: {
        receiptId: 'receipt-latest',
        skillId: 'workspace-draft-draft-1',
        sourceId: 'workspace-skill-drafts',
        version: '20260426000300',
        status: 'installed',
        phase: 'installed',
        installedAt: '2026-04-26T00:03:00.000Z'
      },
      provenance: {
        sourceKind: 'workspace-draft',
        sourceTaskId: 'task-1',
        sourceEvidenceIds: ['evidence-1'],
        manifestId: 'workspace-draft-draft-1',
        manifestSourceId: 'workspace-skill-drafts'
      },
      lifecycle: {
        draftStatus: 'active',
        installStatus: 'installed',
        reusable: true,
        nextAction: 'ready_to_reuse'
      }
    });
    expect(JSON.stringify(draft)).not.toContain('/tmp/raw-old');
    expect(JSON.stringify(draft)).not.toContain('raw detail must not leak');
  });

  it('normalizes in-progress install phases and draft next actions', () => {
    expect(
      attachSkillDraftInstallSummaries(
        [
          {
            draftId: 'draft-installing',
            status: 'trusted',
            title: 'Installing draft',
            summary: 'installing',
            createdAt: '2026-04-26T00:00:00.000Z',
            updatedAt: '2026-04-26T00:00:00.000Z'
          },
          {
            draftId: 'draft-pending',
            status: 'draft',
            title: 'Pending draft',
            summary: 'pending',
            createdAt: '2026-04-26T00:00:00.000Z',
            updatedAt: '2026-04-26T00:00:00.000Z'
          },
          {
            draftId: 'draft-failed',
            status: 'active',
            title: 'Failed draft',
            summary: 'failed',
            createdAt: '2026-04-26T00:00:00.000Z',
            updatedAt: '2026-04-26T00:00:00.000Z'
          },
          {
            draftId: 'draft-review',
            status: 'shadow',
            title: 'Review draft',
            summary: 'review',
            createdAt: '2026-04-26T00:00:00.000Z',
            updatedAt: '2026-04-26T00:00:00.000Z'
          },
          {
            draftId: 'draft-active',
            status: 'active',
            title: 'Active draft',
            summary: 'active',
            createdAt: '2026-04-26T00:00:00.000Z',
            updatedAt: '2026-04-26T00:00:00.000Z'
          }
        ] as any,
        [
          {
            id: 'receipt-installing',
            skillId: 'workspace-draft-draft-installing',
            sourceId: 'workspace-skill-drafts',
            version: '20260426000100',
            status: 'approved',
            phase: 'installing'
          },
          {
            id: 'receipt-pending',
            skillId: 'workspace-draft-draft-pending',
            sourceId: 'workspace-skill-drafts',
            version: '20260426000100',
            status: 'pending',
            phase: 'requested'
          },
          {
            id: 'receipt-failed',
            skillId: 'workspace-draft-draft-failed',
            sourceId: 'workspace-skill-drafts',
            version: '20260426000100',
            status: 'failed',
            phase: 'failed'
          }
        ] as any
      ).map(draft => ({
        draftId: draft.draftId,
        installStatus: draft.install?.status,
        nextAction: draft.lifecycle?.nextAction
      }))
    ).toEqual([
      {
        draftId: 'draft-installing',
        installStatus: 'installing',
        nextAction: 'install_from_skill_lab'
      },
      {
        draftId: 'draft-pending',
        installStatus: 'pending',
        nextAction: 'approve_install'
      },
      {
        draftId: 'draft-failed',
        installStatus: 'failed',
        nextAction: 'retry_install'
      },
      {
        draftId: 'draft-review',
        installStatus: undefined,
        nextAction: 'review_draft'
      },
      {
        draftId: 'draft-active',
        installStatus: undefined,
        nextAction: 'install_from_skill_lab'
      }
    ]);
  });
});
