import { describe, expect, it } from 'vitest';

import { buildSkillDraftInstallCandidate, type SkillDraftRecord } from '../src/drafts';

function createDraft(overrides: Partial<SkillDraftRecord> = {}): SkillDraftRecord {
  return {
    id: 'draft-1',
    workspaceId: 'workspace-1',
    title: 'Capture release handoff',
    description: 'Turns release notes into a reusable handoff skill.',
    triggerHints: ['release handoff'],
    bodyMarkdown: 'Summarize release notes with evidence and next steps.',
    requiredTools: ['read_file'],
    requiredConnectors: ['github'],
    sourceTaskId: 'task-1',
    source: 'learning-suggestion',
    authorId: 'agent-worker',
    riskLevel: 'medium',
    confidence: 0.88,
    sourceEvidenceIds: ['evidence-1'],
    status: 'draft',
    reuseStats: {
      count: 2,
      lastRunId: 'run-2',
      lastReusedAt: '2026-04-26T10:00:00.000Z'
    },
    approvedBy: 'reviewer-1',
    approvedAt: '2026-04-26T10:30:00.000Z',
    createdAt: '2026-04-26T09:00:00.000Z',
    updatedAt: '2026-04-26T10:30:00.000Z',
    ...overrides
  };
}

describe('skill draft install candidate projection', () => {
  it('rejects drafts that have not been approved for intake', () => {
    expect(() => buildSkillDraftInstallCandidate(createDraft({ status: 'draft' }))).toThrow(
      'Skill draft draft-1 must be active or trusted before install candidate projection.'
    );
  });

  it.each(['active', 'trusted'] as const)('projects %s drafts into install candidates', status => {
    const candidate = buildSkillDraftInstallCandidate(createDraft({ status }));

    expect(candidate).toEqual({
      title: 'Capture release handoff',
      description: 'Turns release notes into a reusable handoff skill.',
      bodyMarkdown: 'Summarize release notes with evidence and next steps.',
      requiredTools: ['read_file'],
      requiredConnectors: ['github'],
      sourceTaskId: 'task-1',
      sourceEvidenceIds: ['evidence-1'],
      riskLevel: 'medium',
      confidence: 0.88,
      reuseStats: {
        count: 2,
        lastRunId: 'run-2',
        lastReusedAt: '2026-04-26T10:00:00.000Z'
      }
    });
  });

  it('does not leak raw metadata or mutable draft arrays into install candidates', () => {
    const draft = createDraft({ status: 'active' }) as SkillDraftRecord & {
      rawMetadata: {
        providerPayload: string;
      };
    };
    draft.rawMetadata = {
      providerPayload: 'must-not-leak'
    };

    const candidate = buildSkillDraftInstallCandidate(draft);
    draft.requiredTools.push('shell');
    draft.requiredConnectors.push('linear');
    draft.sourceEvidenceIds.push('evidence-2');
    draft.reuseStats.count = 99;

    expect(candidate).not.toHaveProperty('rawMetadata');
    expect(candidate).not.toHaveProperty('workspaceId');
    expect(candidate).not.toHaveProperty('authorId');
    expect(candidate).toEqual(
      expect.objectContaining({
        requiredTools: ['read_file'],
        requiredConnectors: ['github'],
        sourceEvidenceIds: ['evidence-1'],
        reuseStats: {
          count: 2,
          lastRunId: 'run-2',
          lastReusedAt: '2026-04-26T10:00:00.000Z'
        }
      })
    );
  });
});
