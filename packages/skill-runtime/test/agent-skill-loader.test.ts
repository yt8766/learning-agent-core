import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import type { SkillSourceRecord } from '@agent/core';

import { loadAgentSkillManifests } from '../src/agent-skill-loader';

describe('loadAgentSkillManifests', () => {
  it('loads Deep Agents style SKILL.md frontmatter into manifests', async () => {
    const root = await mkdtemp(join(tmpdir(), 'agent-skill-loader-'));
    const skillDir = join(root, 'code-review');
    await mkdir(skillDir, { recursive: true });
    await writeFile(
      join(skillDir, 'SKILL.md'),
      `---
name: code_review
description: Review code and regression risks.
version: "1.2.0"
publisher: workspace
license: Proprietary
compatibility: Requires repo access.
metadata:
  ministry: xingbu-review
triggers:
  - review
recommended-ministries:
  - xingbu-review
recommended-specialists:
  - risk-compliance
allowed-tools:
  - read_local_file
  - list_directory
execution-hints:
  - Focus on regression risk first.
compression-hints:
  - Prefer summary over raw diff spam.
approval-policy: none
risk-level: low
---

# Code Review

Use this skill for code review and regression analysis.
`
    );

    const sources: SkillSourceRecord[] = [
      {
        id: 'workspace-skills',
        name: 'Workspace Skills',
        kind: 'internal',
        baseUrl: root,
        trustClass: 'internal',
        priority: 'workspace/internal',
        enabled: true
      }
    ];

    const manifests = await loadAgentSkillManifests(sources);
    expect(manifests).toEqual([
      expect.objectContaining({
        id: 'code_review',
        name: 'code_review',
        version: '1.2.0',
        sourceId: 'workspace-skills',
        license: 'Proprietary',
        compatibility: 'Requires repo access.',
        triggers: ['review'],
        preferredMinistries: ['xingbu-review'],
        recommendedSpecialists: ['risk-compliance'],
        allowedTools: ['read_local_file', 'list_directory'],
        executionHints: ['Focus on regression risk first.'],
        compressionHints: ['Prefer summary over raw diff spam.'],
        approvalPolicy: 'none',
        riskLevel: 'low'
      })
    ]);
  });
});
