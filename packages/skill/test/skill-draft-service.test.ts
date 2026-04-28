import { describe, expect, it } from 'vitest';

import { InMemorySkillDraftRepository, SkillDraftService } from '../src/drafts';

function createService(): SkillDraftService {
  return new SkillDraftService({
    repository: new InMemorySkillDraftRepository()
  });
}

describe('skill draft service', () => {
  it('createSkillDraft stores a draft record', async () => {
    const service = createService();

    const draft = await service.createSkillDraft({
      workspaceId: 'workspace-1',
      title: 'Summarize incident notes',
      description: 'Capture a reusable incident summary workflow.',
      triggerHints: ['incident notes'],
      bodyMarkdown: 'Summarize incident notes with evidence links.',
      requiredTools: ['read_file'],
      requiredConnectors: [],
      sourceTaskId: 'task-1',
      source: 'workspace-vault',
      authorId: 'agent-worker',
      riskLevel: 'low',
      confidence: 0.82,
      sourceEvidenceIds: ['run-123']
    });

    await expect(service.getSkillDraft(draft.id)).resolves.toEqual(draft);
    await expect(service.listSkillDrafts()).resolves.toEqual([draft]);
    expect(draft).toEqual(
      expect.objectContaining({
        status: 'draft',
        title: 'Summarize incident notes',
        workspaceId: 'workspace-1',
        reuseStats: {
          count: 0,
          lastReusedAt: undefined
        }
      })
    );
  });

  it('approveSkillDraft promotes a low-risk draft to active', async () => {
    const service = createService();
    const draft = await service.createSkillDraft({
      workspaceId: 'workspace-1',
      title: 'Normalize support ticket',
      bodyMarkdown: 'Normalize support ticket details.',
      sourceTaskId: 'task-1',
      source: 'learning-suggestion',
      riskLevel: 'low'
    });

    const approved = await service.approveSkillDraft(draft.id, {
      reviewerId: 'human-reviewer'
    });

    expect(approved).toEqual(
      expect.objectContaining({
        id: draft.id,
        status: 'active',
        approvedBy: 'human-reviewer'
      })
    );
  });

  it('rejectSkillDraft marks the draft as rejected with reviewer context', async () => {
    const service = createService();
    const draft = await service.createSkillDraft({
      workspaceId: 'workspace-1',
      title: 'Draft from noisy trace',
      bodyMarkdown: 'Draft a reusable workflow from a trace.',
      sourceTaskId: 'task-1',
      source: 'learning-suggestion',
      riskLevel: 'medium'
    });

    const rejected = await service.rejectSkillDraft(draft.id, {
      reviewerId: 'human-reviewer',
      reason: 'Needs clearer evidence.'
    });

    expect(rejected).toEqual(
      expect.objectContaining({
        id: draft.id,
        status: 'rejected',
        rejectedBy: 'human-reviewer',
        rejectionReason: 'Needs clearer evidence.'
      })
    );
  });

  it('approveSkillDraft blocks high-risk drafts without evidence', async () => {
    const service = createService();
    const draft = await service.createSkillDraft({
      workspaceId: 'workspace-1',
      title: 'Run production migration',
      bodyMarkdown: 'Run the production migration checklist.',
      sourceTaskId: 'task-1',
      source: 'workspace-vault',
      riskLevel: 'high'
    });

    await expect(
      service.approveSkillDraft(draft.id, {
        reviewerId: 'human-reviewer'
      })
    ).rejects.toThrow('High or critical skill drafts require evidence before approval.');
  });

  it('recordSkillReuse increments reuse stats for active drafts', async () => {
    const service = createService();
    const draft = await service.createSkillDraft({
      workspaceId: 'workspace-1',
      title: 'Triage flaky test',
      bodyMarkdown: 'Triage flaky tests with deterministic repro steps.',
      sourceTaskId: 'task-1',
      source: 'workspace-vault',
      riskLevel: 'low'
    });
    await service.approveSkillDraft(draft.id, {
      reviewerId: 'human-reviewer'
    });

    const firstReuse = await service.recordSkillReuse(draft.id, {
      runId: 'run-1'
    });
    const secondReuse = await service.recordSkillReuse(draft.id, {
      runId: 'run-2'
    });

    expect(firstReuse.reuseStats.count).toBe(1);
    expect(secondReuse.reuseStats).toEqual(
      expect.objectContaining({
        count: 2,
        lastRunId: 'run-2'
      })
    );
    expect(secondReuse.reuseStats.lastReusedAt).toEqual(expect.any(String));
  });
});
