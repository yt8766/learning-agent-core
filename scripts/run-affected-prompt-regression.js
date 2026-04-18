import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { readChangedPaths } from './affected-workspace.js';
import { resolvePromptRegressionRun } from './check-staged.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const runnerPath = path.join(repoRoot, 'scripts/run-prompt-regression.js');

const changed = readChangedPaths();

if (!changed.hasReadableSignal) {
  console.warn('[affected-prompt-regression] unable to resolve changed files from git; running full prompt regression');
  runPromptRegression();
}

const promptRegression = resolvePromptRegressionRun(changed.paths);

if (!promptRegression.required) {
  console.log(
    `[affected-prompt-regression] no prompt-sensitive files changed for base ref ${changed.baseRef}; skipping`
  );
  process.exit(0);
}

console.log(
  `[affected-prompt-regression] running prompt regression for ${promptRegression.files.length} changed files`
);
runPromptRegression();

function runPromptRegression() {
  const result = spawnSync(process.execPath, [runnerPath], {
    cwd: repoRoot,
    stdio: 'inherit'
  });

  process.exit(result.status ?? 1);
}
