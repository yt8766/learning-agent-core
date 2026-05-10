import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { beforeEach, describe, expect, it } from 'vitest';

import {
  createRuntimeWorkspaceDraftStore,
  resetRuntimeWorkspaceDraftStore
} from '../../../src/runtime/centers/runtime-centers-workspace-drafts';
import { SkillArtifactFetcher } from '../../../src/runtime/skills/skill-artifact-fetcher';

describe('WorkspaceDraftSkillArtifactFetcher', () => {
  let workspaceRoot: string;

  beforeEach(async () => {
    resetRuntimeWorkspaceDraftStore();
    workspaceRoot = await mkdtemp(join(tmpdir(), 'workspace-draft-artifact-'));
  });

  it('materializes workspace-draft entries from the draft store into staging artifacts', async () => {
    const store = createRuntimeWorkspaceDraftStore({
      filePath: join(workspaceRoot, 'profile-storage', 'platform', 'skills', 'drafts', 'workspace-drafts.json'),
      createId: () => 'draft-browser-evidence',
      now: () => new Date('2026-04-26T01:02:03.000Z')
    });
    await store.seedDraft({
      workspaceId: 'workspace-platform',
      title: 'Reuse browser evidence',
      description: 'Capture repeated browser evidence collection.',
      triggerHints: ['browser evidence'],
      bodyMarkdown: '# Reuse browser evidence\n\nOpen the evidence source and cite it.',
      requiredTools: ['browser.open'],
      requiredConnectors: ['browser-mcp'],
      sourceTaskId: 'task-1',
      source: 'workspace-vault',
      riskLevel: 'medium',
      confidence: 0.82,
      sourceEvidenceIds: ['evidence-1']
    });
    await store.approveDraftForInstallCandidate('draft-browser-evidence', { reviewerId: 'reviewer-1' });

    const fetcher = new SkillArtifactFetcher(workspaceRoot);
    const result = await fetcher.fetchToStaging(
      {
        id: 'workspace-draft-draft-browser-evidence',
        sourceId: 'workspace-skill-drafts',
        name: 'Reuse browser evidence',
        description: 'Capture repeated browser evidence collection.',
        version: '20260426010203',
        entry: 'workspace-draft:draft-browser-evidence',
        riskLevel: 'medium',
        approvalPolicy: 'high-risk-only',
        requiredCapabilities: ['browser.open'],
        requiredConnectors: ['browser-mcp'],
        allowedTools: ['browser.open']
      } as never,
      {
        id: 'workspace-skill-drafts',
        kind: 'internal',
        enabled: true
      } as never,
      'receipt-workspace-draft'
    );

    expect(result).toEqual(
      expect.objectContaining({
        integrityVerified: true,
        metadata: {
          mode: 'workspace-draft',
          draftId: 'draft-browser-evidence'
        }
      })
    );
    await expect(readFile(join(result.stagingDir, 'SKILL.md'), 'utf8')).resolves.toContain('Open the evidence source');
    await expect(readFile(join(result.stagingDir, 'manifest.json'), 'utf8')).resolves.toContain(
      'workspace-draft-draft-browser-evidence'
    );
  });
});
