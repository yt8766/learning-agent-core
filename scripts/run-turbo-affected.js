import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildTurboAffectedFilter, resolveAffectedBaseRef } from './affected-workspace.js';
import { runTurboTasks } from './turbo-runner.js';

const tasks = process.argv.slice(2);
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
if (tasks.length === 0) {
  console.error('[turbo-affected] expected at least one Turbo task name');
  process.exit(1);
}

const baseRef = resolveAffectedBaseRef();
const filter = buildTurboAffectedFilter(baseRef);

console.log(`[turbo-affected] running ${tasks.join(', ')} with filter ${filter}`);

const result = runTurboTasks(tasks, {
  cwd: repoRoot,
  filter
});

process.exit(result.status ?? 1);
