import { access, mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { FileSkillDraftRepository, InMemorySkillSourceRemoteCacheRepository } from '@agent/skill';
import type { SkillSourceRecord } from '@agent/core';
import { describe, expect, it } from 'vitest';

import { SkillArtifactFetcher } from '../../../src/runtime/skills/skill-artifact-fetcher';
import {
  readInstalledSkillRecords,
  readSkillInstallReceipts,
  writeInstalledSkillRecord,
  writeSkillInstallReceipt
} from '../../../src/runtime/skills/runtime-skill-install.service';
import { SkillSourceSyncService } from '../../../src/runtime/skills/skill-source-sync.service';

describe('runtime skill persistence repository boundary', () => {
  it('syncs remote source cache through the injected repository without root data/skills writes', async () => {
    const root = await mkdtemp(join(tmpdir(), 'skill-source-repository-boundary-'));
    const sourceRoot = join(root, 'remote-source-input');
    await mkdir(sourceRoot, { recursive: true });
    await writeFile(
      join(sourceRoot, 'index.json'),
      JSON.stringify({
        manifests: [
          {
            id: 'remote-review',
            name: 'Remote Review',
            version: '0.1.0',
            description: 'Remote review skill',
            publisher: 'workspace',
            sourceId: 'bundled-marketplace',
            requiredCapabilities: ['code-review'],
            approvalPolicy: 'none',
            riskLevel: 'low',
            entry: 'remote/remote-review/SKILL.md',
            license: 'Proprietary'
          }
        ]
      })
    );
    const remoteCacheRepository = new InMemorySkillSourceRemoteCacheRepository();
    const service = new SkillSourceSyncService({
      workspaceRoot: root,
      profile: 'platform',
      remoteCacheRepository
    });
    const source: SkillSourceRecord = {
      id: 'bundled-marketplace',
      name: 'Bundled Marketplace',
      kind: 'marketplace',
      baseUrl: sourceRoot,
      discoveryMode: 'remote-index',
      indexUrl: join(sourceRoot, 'index.json'),
      trustClass: 'curated',
      priority: 'bundled/marketplace',
      enabled: true
    };

    const result = await service.syncSource(source);

    expect(result).toEqual(
      expect.objectContaining({
        status: 'synced',
        cacheFilePath: 'memory://remote-source-cache/bundled-marketplace',
        manifestCount: 1
      })
    );
    await expect(service.readCachedManifests(source)).resolves.toEqual([
      expect.objectContaining({ id: 'remote-review', sourceId: 'bundled-marketplace' })
    ]);
    await expect(access(join(root, 'data', 'skills', 'remote-sources'))).rejects.toThrow();
  });

  it('materializes workspace draft artifacts through draft storage without reading root data/skills drafts', async () => {
    const root = await mkdtemp(join(tmpdir(), 'skill-draft-repository-boundary-'));
    const repository = new FileSkillDraftRepository({
      filePath: join(root, 'backend-storage', 'workspace-drafts.json')
    });
    await repository.create({
      id: 'draft-browser-evidence',
      workspaceId: 'workspace-1',
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
      sourceEvidenceIds: ['evidence-1'],
      status: 'active',
      reuseStats: { count: 0 },
      approvedBy: 'reviewer-1',
      approvedAt: '2026-04-26T01:02:03.000Z',
      createdAt: '2026-04-26T01:00:00.000Z',
      updatedAt: '2026-04-26T01:02:03.000Z'
    });
    const fetcher = new SkillArtifactFetcher(root, { skillDraftRepository: repository });

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
      } as any,
      {
        id: 'workspace-skill-drafts',
        kind: 'internal',
        enabled: true
      } as any,
      'receipt-workspace-draft'
    );

    expect(result).toEqual(
      expect.objectContaining({
        integrityVerified: true,
        metadata: { mode: 'workspace-draft', draftId: 'draft-browser-evidence' }
      })
    );
    await expect(access(join(root, 'data', 'skills', 'drafts'))).rejects.toThrow();
  });

  it('requires an install repository for receipts and installed records instead of root data/skills fallback', async () => {
    const root = await mkdtemp(join(tmpdir(), 'skill-install-repository-boundary-'));
    const context = {
      settings: {
        workspaceRoot: root,
        skillReceiptsRoot: join(root, 'data', 'skills', 'receipts'),
        skillPackagesRoot: join(root, 'data', 'skills', 'installed')
      }
    } as any;

    await expect(readSkillInstallReceipts(context)).rejects.toThrow('skill_install_repository_required');
    await expect(
      writeSkillInstallReceipt(context, {
        id: 'receipt-a',
        skillId: 'skill-a',
        version: '1.0.0',
        sourceId: 'source-a',
        approvedBy: 'tester',
        phase: 'approved',
        status: 'approved',
        result: 'approved'
      })
    ).rejects.toThrow('skill_install_repository_required');
    await expect(readInstalledSkillRecords(context)).rejects.toThrow('skill_install_repository_required');
    await expect(
      writeInstalledSkillRecord(context, {
        skillId: 'skill-a',
        version: '1.0.0',
        sourceId: 'source-a',
        installLocation: join(root, 'install-location'),
        installedAt: '2026-04-02T00:00:00.000Z',
        status: 'installed',
        receiptId: 'receipt-a'
      })
    ).rejects.toThrow('skill_install_repository_required');
    await expect(access(join(root, 'data', 'skills'))).rejects.toThrow();
  });
});
