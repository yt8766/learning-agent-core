import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import type { SkillSourceRecord } from '@agent/shared';

import { SkillSourceSyncService } from '../../../src/runtime/skills/skill-source-sync.service';

describe('SkillSourceSyncService', () => {
  it('syncs a local remote-index source into cache and reads it back', async () => {
    const root = await mkdtemp(join(tmpdir(), 'skill-source-sync-'));
    const sourceRoot = join(root, 'remote-sources');
    await mkdir(sourceRoot, { recursive: true });
    await writeFile(
      join(sourceRoot, 'index.json'),
      JSON.stringify(
        {
          manifests: [
            {
              id: 'remote_review',
              name: 'Remote Review',
              version: '0.1.0',
              description: 'Remote review skill',
              publisher: 'workspace',
              sourceId: 'bundled-marketplace',
              requiredCapabilities: ['code-review'],
              approvalPolicy: 'none',
              riskLevel: 'low',
              entry: 'remote/remote-review/SKILL.md',
              integrity: 'sha256-test',
              license: 'Proprietary',
              compatibility: 'Repo access'
            }
          ]
        },
        null,
        2
      )
    );

    const service = new SkillSourceSyncService({
      workspaceRoot: root,
      profile: 'platform'
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
    expect(result.status).toBe('synced');
    expect(result.manifestCount).toBe(1);

    const cached = await service.readCachedManifests(source);
    expect(cached).toEqual([
      expect.objectContaining({
        id: 'remote_review',
        sourceId: 'bundled-marketplace'
      })
    ]);

    const cacheFile = await readFile(
      join(root, 'data', 'skills', 'remote-sources', 'bundled-marketplace', 'index.json'),
      'utf8'
    );
    expect(cacheFile).toContain('remote_review');
  });
});
