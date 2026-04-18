import { spawnSync } from 'node:child_process';

import { buildTurboAffectedFilter, resolveAffectedBaseRef } from './affected-workspace.js';

const tasks = process.argv.slice(2);

if (tasks.length === 0) {
  console.error('[turbo-affected] expected at least one Turbo task name');
  process.exit(1);
}

const baseRef = resolveAffectedBaseRef();
const filter = buildTurboAffectedFilter(baseRef);

console.log(`[turbo-affected] running ${tasks.join(', ')} with filter ${filter}`);

const result = spawnSync('pnpm', ['exec', 'turbo', 'run', ...tasks, `--filter=${filter}`], {
  stdio: 'inherit'
});

process.exit(result.status ?? 1);
