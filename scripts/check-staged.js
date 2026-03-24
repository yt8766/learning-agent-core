import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tsc = path.join(rootDir, 'node_modules/typescript/lib/tsc.js');

const PRETTIER_EXTENSIONS = new Set([
  '.js',
  '.ts',
  '.mjs',
  '.cjs',
  '.json',
  '.tsx',
  '.css',
  '.less',
  '.scss',
  '.html',
  '.md'
]);

const ESLINT_EXTENSIONS = new Set(['.js', '.ts', '.tsx', '.mjs', '.cjs']);

const TSC_PROJECT_RULES = [
  { test: file => file.startsWith('packages/config/'), project: 'packages/config/tsconfig.json' },
  { test: file => file.startsWith('packages/shared/'), project: 'packages/shared/tsconfig.json' },
  { test: file => file.startsWith('packages/memory/'), project: 'packages/memory/tsconfig.json' },
  { test: file => file.startsWith('packages/evals/'), project: 'packages/evals/tsconfig.json' },
  { test: file => file.startsWith('packages/tools/'), project: 'packages/tools/tsconfig.json' },
  { test: file => file.startsWith('packages/skills/'), project: 'packages/skills/tsconfig.json' },
  { test: file => file.startsWith('packages/agent-core/'), project: 'packages/agent-core/tsconfig.json' },
  { test: file => file.startsWith('apps/backend/agent-server/'), project: 'apps/backend/agent-server/tsconfig.json' },
  { test: file => file.startsWith('apps/worker/'), project: 'apps/worker/tsconfig.json' },
  {
    test: file => file.startsWith('apps/frontend/agent-admin/src/'),
    project: 'apps/frontend/agent-admin/tsconfig.app.json'
  },
  {
    test: file => file === 'apps/frontend/agent-admin/vite.config.ts',
    project: 'apps/frontend/agent-admin/tsconfig.node.json'
  },
  {
    test: file => file.startsWith('apps/frontend/agent-chat/src/'),
    project: 'apps/frontend/agent-chat/tsconfig.app.json'
  },
  {
    test: file => file === 'apps/frontend/agent-chat/vite.config.ts',
    project: 'apps/frontend/agent-chat/tsconfig.node.json'
  }
];

const FULL_TYPECHECK_TRIGGERS = [
  'package.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  'turbo.json',
  'tsconfig.json',
  'tsconfig.app.json',
  'tsconfig.node.json',
  'eslint.config.mjs',
  'prettier.config.js',
  'vitest.config.js'
];

const ALL_TYPECHECK_PROJECTS = [
  'packages/config/tsconfig.json',
  'packages/shared/tsconfig.json',
  'packages/memory/tsconfig.json',
  'packages/evals/tsconfig.json',
  'packages/tools/tsconfig.json',
  'packages/skills/tsconfig.json',
  'packages/agent-core/tsconfig.json',
  'apps/backend/agent-server/tsconfig.json',
  'apps/worker/tsconfig.json',
  'apps/frontend/agent-admin/tsconfig.app.json',
  'apps/frontend/agent-chat/tsconfig.app.json',
  'apps/frontend/agent-chat/tsconfig.node.json'
];

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: rootDir,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    ...options
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function getStagedFiles() {
  const result = spawnSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR'], {
    cwd: rootDir,
    encoding: 'utf8',
    shell: process.platform === 'win32'
  });

  if (result.status !== 0) {
    console.error('[check:staged] failed to read staged files');
    process.exit(result.status ?? 1);
  }

  return result.stdout
    .split(/\r?\n/)
    .map(item => item.trim())
    .filter(Boolean)
    .filter(file => fs.existsSync(path.join(rootDir, file)));
}

function toPosix(file) {
  return file.replace(/\\/g, '/');
}

function unique(items) {
  return [...new Set(items)];
}

function resolveTypecheckProjects(files) {
  const normalized = files.map(toPosix);
  const shouldRunAll = normalized.some(file => {
    if (FULL_TYPECHECK_TRIGGERS.includes(file)) {
      return true;
    }

    return file.startsWith('.husky/') || file.startsWith('.github/workflows/') || file.startsWith('scripts/');
  });

  if (shouldRunAll) {
    return ALL_TYPECHECK_PROJECTS;
  }

  return unique(
    normalized.flatMap(file => TSC_PROJECT_RULES.filter(rule => rule.test(file)).map(rule => rule.project))
  );
}

function main() {
  const stagedFiles = getStagedFiles();

  if (stagedFiles.length === 0) {
    console.log('[check:staged] no staged files');
    return;
  }

  const prettierFiles = stagedFiles.filter(file => PRETTIER_EXTENSIONS.has(path.extname(file).toLowerCase()));
  const eslintFiles = stagedFiles.filter(file => ESLINT_EXTENSIONS.has(path.extname(file).toLowerCase()));
  const typecheckProjects = resolveTypecheckProjects(stagedFiles);

  if (prettierFiles.length > 0) {
    console.log('[check:staged] prettier:', prettierFiles.length, 'files');
    run('pnpm', ['exec', 'prettier', '--write', ...prettierFiles]);
  }

  if (eslintFiles.length > 0) {
    console.log('[check:staged] eslint:', eslintFiles.length, 'files');
    run('pnpm', ['exec', 'eslint', '--fix', ...eslintFiles]);
  }

  if (prettierFiles.length > 0 || eslintFiles.length > 0) {
    run('git', ['add', '--', ...unique([...prettierFiles, ...eslintFiles])]);
  }

  if (typecheckProjects.length > 0) {
    console.log('[check:staged] typecheck projects:', typecheckProjects.join(', '));
    for (const project of typecheckProjects) {
      run(process.execPath, [tsc, '--noEmit', '-p', project], { shell: false });
    }
  } else {
    console.log('[check:staged] no affected TypeScript projects');
  }
}

main();
