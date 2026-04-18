import { spawnSync } from 'node:child_process';

import { readChangedPaths, resolveAffectedLintFiles } from './affected-workspace.js';

const tool = process.argv[2];

if (tool !== 'prettier' && tool !== 'eslint') {
  console.error('[affected-lint] expected tool to be "prettier" or "eslint"');
  process.exit(1);
}

const changed = readChangedPaths();

if (!changed.hasReadableSignal) {
  console.warn(`[affected-lint] unable to resolve changed files from git; falling back to full ${tool} check`);
  runFallback(tool);
  process.exit(0);
}

const scope = resolveAffectedLintFiles(changed.paths, tool);

if (scope.mode === 'none') {
  console.log(`[affected-lint] no ${tool}-relevant files changed for base ref ${changed.baseRef}`);
  process.exit(0);
}

if (scope.mode === 'all') {
  console.log(`[affected-lint] global ${tool} inputs changed; running full workspace ${tool} check`);
  runFallback(tool);
  process.exit(0);
}

const args =
  tool === 'prettier'
    ? ['exec', 'prettier', '--check', ...scope.files]
    : ['exec', 'eslint', '--max-warnings=0', '--no-warn-ignored', ...scope.files];

console.log(
  `[affected-lint] running ${tool} for ${scope.files.length} changed files against base ref ${changed.baseRef}`
);

const result = spawnSync('pnpm', args, {
  stdio: 'inherit'
});

process.exit(result.status ?? 1);

function runFallback(currentTool) {
  const command = currentTool === 'prettier' ? 'lint:prettier:check' : 'lint:eslint:check';
  const result = spawnSync('pnpm', [command], {
    stdio: 'inherit'
  });

  process.exit(result.status ?? 1);
}
