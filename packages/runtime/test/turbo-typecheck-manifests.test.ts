import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

const workspaceManifests = [
  'packages/adapters/package.json',
  'packages/config/package.json',
  'packages/core/package.json',
  'packages/evals/package.json',
  'packages/knowledge/package.json',
  'packages/memory/package.json',
  'packages/platform-runtime/package.json',
  'packages/report-kit/package.json',
  'packages/runtime/package.json',
  'packages/skill/package.json',
  'packages/templates/package.json',
  'packages/tools/package.json',
  'agents/coder/package.json',
  'agents/data-report/package.json',
  'agents/reviewer/package.json',
  'agents/supervisor/package.json',
  'apps/backend/agent-server/package.json',
  'apps/frontend/agent-admin/package.json',
  'apps/frontend/agent-chat/package.json',
  'apps/worker/package.json'
];

describe('turbo:typecheck manifest wiring', () => {
  it('does not reference the removed package typecheck helper in turbo global dependencies', async () => {
    const turboConfig = await readJson('turbo.json');

    expect(turboConfig.globalDependencies).not.toContain('scripts/run-package-typecheck.js');
  });

  it('routes every workspace turbo:typecheck through the local typecheck script', async () => {
    const scriptEntries = await Promise.all(
      workspaceManifests.map(async manifestPath => {
        const manifest = await readJson(manifestPath);

        return {
          manifestPath,
          turboTypecheck: manifest.scripts?.['turbo:typecheck']
        };
      })
    );

    expect(scriptEntries).toEqual(
      workspaceManifests.map(manifestPath => ({
        manifestPath,
        turboTypecheck: 'pnpm typecheck'
      }))
    );
  });

  it('keeps runtime package type exports pointed at emitted declaration files', async () => {
    const manifest = await readJson('packages/runtime/package.json');
    const typePaths = collectTypePaths(manifest);

    await Promise.all(
      typePaths.map(async typePath => {
        await expect(
          access(path.join(repoRoot, 'packages/runtime', typePath.replace(/^\.\//, '')))
        ).resolves.toBeUndefined();
      })
    );
  });

  it('keeps the unified backend server on package type boundaries for core contracts', async () => {
    const configPath = 'apps/backend/agent-server/tsconfig.build.json';
    const config = await readJson(configPath);

    expect({
      configPath,
      corePath: config.compilerOptions?.paths?.['@agent/core']
    }).toEqual({
      configPath,
      corePath: undefined
    });
  });
});

async function readJson(relativePath: string) {
  const absolutePath = path.join(repoRoot, relativePath);
  const content = await readFile(absolutePath, 'utf8');

  return JSON.parse(content) as {
    globalDependencies?: string[];
    compilerOptions?: {
      paths?: Record<string, string[]>;
    };
    exports?: Record<string, unknown>;
    scripts?: Record<string, string>;
    types?: string;
  };
}

function collectTypePaths(manifest: { exports?: Record<string, unknown>; types?: string }) {
  const typePaths = new Set<string>();

  if (manifest.types) {
    typePaths.add(manifest.types);
  }

  for (const exportEntry of Object.values(manifest.exports ?? {})) {
    if (!exportEntry || typeof exportEntry !== 'object') {
      continue;
    }

    for (const condition of ['import', 'require']) {
      const conditionalEntry = (exportEntry as Record<string, unknown>)[condition];

      if (!conditionalEntry || typeof conditionalEntry !== 'object') {
        continue;
      }

      const typePath = (conditionalEntry as Record<string, unknown>).types;
      if (typeof typePath === 'string') {
        typePaths.add(typePath);
      }
    }
  }

  return [...typePaths].sort();
}
