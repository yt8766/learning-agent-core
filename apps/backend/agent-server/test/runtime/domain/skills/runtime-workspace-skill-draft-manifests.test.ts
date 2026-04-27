import { describe, expect, it } from 'vitest';

import { buildWorkspaceSkillDraftManifests } from '../../../../src/runtime/domain/skills/runtime-workspace-skill-draft-manifests';

describe('runtime workspace skill draft manifests', () => {
  it('projects active and trusted workspace drafts as internal skill manifests', () => {
    const manifests = buildWorkspaceSkillDraftManifests([
      {
        id: 'draft-1',
        workspaceId: 'workspace-platform',
        title: 'Reuse browser evidence',
        description: 'Capture repeated browser evidence collection.',
        triggerHints: ['browser evidence'],
        bodyMarkdown: '# Reuse browser evidence',
        requiredTools: ['browser.open'],
        requiredConnectors: ['browser-mcp'],
        sourceTaskId: 'task-1',
        source: 'workspace-vault',
        riskLevel: 'medium',
        confidence: 0.82,
        sourceEvidenceIds: ['evidence-1'],
        status: 'active',
        reuseStats: { count: 3 },
        createdAt: '2026-04-26T00:00:00.000Z',
        updatedAt: '2026-04-26T01:02:03.000Z'
      },
      {
        id: 'draft-2',
        workspaceId: 'workspace-platform',
        title: 'Skip unapproved draft',
        triggerHints: [],
        bodyMarkdown: '# Skip',
        requiredTools: [],
        requiredConnectors: [],
        sourceTaskId: 'task-2',
        source: 'workspace-vault',
        riskLevel: 'low',
        confidence: 0.5,
        sourceEvidenceIds: [],
        status: 'draft',
        reuseStats: { count: 0 },
        createdAt: '2026-04-26T00:00:00.000Z',
        updatedAt: '2026-04-26T01:00:00.000Z'
      }
    ]);

    expect(manifests).toHaveLength(1);
    expect(manifests[0]).toMatchObject({
      id: 'workspace-draft-draft-1',
      name: 'Reuse browser evidence',
      version: '20260426010203',
      description: 'Capture repeated browser evidence collection.',
      publisher: 'workspace',
      sourceId: 'workspace-skill-drafts',
      requiredCapabilities: ['browser.open'],
      requiredConnectors: ['browser-mcp'],
      allowedTools: ['browser.open'],
      approvalPolicy: 'high-risk-only',
      riskLevel: 'medium',
      entry: 'workspace-draft:draft-1',
      triggers: ['browser evidence'],
      metadata: {
        draftId: 'draft-1',
        sourceTaskId: 'task-1',
        confidence: '0.82',
        reuseCount: '3'
      }
    });
  });
});
