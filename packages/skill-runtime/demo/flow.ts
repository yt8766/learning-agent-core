import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { loadAgentSkillManifests } from '../src/index.js';

async function main() {
  const root = await mkdtemp(join(tmpdir(), 'skill-runtime-demo-'));

  try {
    const skillDir = join(root, 'runtime-review');
    await mkdir(skillDir, { recursive: true });
    await writeFile(
      join(skillDir, 'SKILL.md'),
      `---
name: runtime_review
description: Review runtime center regressions.
version: "1.0.0"
publisher: workspace
triggers:
  - runtime review
allowed-tools:
  - read_local_file
recommended-ministries:
  - xingbu-review
---

# Runtime Review

Inspect runtime center changes and summarize regression risk.
`,
      'utf8'
    );

    const manifests = await loadAgentSkillManifests([
      {
        id: 'workspace-skills',
        name: 'Workspace Skills',
        kind: 'internal',
        baseUrl: root,
        trustClass: 'internal',
        priority: 'workspace/internal',
        enabled: true
      }
    ]);

    console.log(
      JSON.stringify(
        {
          total: manifests.length,
          firstManifest: manifests[0]
            ? {
                id: manifests[0].id,
                name: manifests[0].name,
                triggers: manifests[0].triggers
              }
            : null
        },
        null,
        2
      )
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

void main();
