import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const packagePathArg = process.argv[2];

if (!packagePathArg) {
  console.error('[integration] missing package path argument');
  process.exit(1);
}

const packageRoot = path.resolve(repoRoot, packagePathArg);
const testRoot = path.join(packageRoot, 'test');

if (!existsSync(testRoot)) {
  console.log(`[integration] no test directory for ${packagePathArg}`);
  process.exit(0);
}

const integrationFiles = [];

collectIntegrationTests(testRoot, integrationFiles);

if (integrationFiles.length === 0) {
  console.log(`[integration] no integration tests found for ${packagePathArg}`);
  process.exit(0);
}

const result = spawnSync('pnpm', ['exec', 'vitest', 'run', '--config', 'vitest.config.js', ...integrationFiles], {
  cwd: repoRoot,
  stdio: 'inherit'
});

if (typeof result.status === 'number') {
  process.exit(result.status);
}

process.exit(1);

function collectIntegrationTests(directory, output) {
  const entries = readdirSync(directory);

  for (const entry of entries) {
    const absolutePath = path.join(directory, entry);
    const entryStats = statSync(absolutePath);

    if (entryStats.isDirectory()) {
      collectIntegrationTests(absolutePath, output);
      continue;
    }

    if (entry.endsWith('.int-spec.ts') || entry.endsWith('.int-spec.tsx')) {
      output.push(path.relative(repoRoot, absolutePath));
    }
  }
}
