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
const TEST_RELATED_EXTENSIONS = new Set(['.js', '.ts', '.tsx', '.mjs', '.cjs', '.json']);

const TSC_PROJECT_RULES = [
  { test: file => file.startsWith('packages/core/'), project: 'packages/core/tsconfig.json' },
  { test: file => file.startsWith('packages/config/'), project: 'packages/config/tsconfig.json' },
  { test: file => file.startsWith('packages/runtime/'), project: 'packages/runtime/tsconfig.json' },
  { test: file => file.startsWith('packages/adapters/'), project: 'packages/adapters/tsconfig.json' },
  { test: file => file.startsWith('packages/memory/'), project: 'packages/memory/tsconfig.json' },
  { test: file => file.startsWith('packages/evals/'), project: 'packages/evals/tsconfig.json' },
  { test: file => file.startsWith('packages/tools/'), project: 'packages/tools/tsconfig.json' },
  { test: file => file.startsWith('packages/skill/'), project: 'packages/skill/tsconfig.json' },
  { test: file => file.startsWith('agents/supervisor/'), project: 'agents/supervisor/tsconfig.json' },
  {
    test: file => file.startsWith('agents/data-report/'),
    project: 'agents/data-report/tsconfig.json'
  },
  { test: file => file.startsWith('agents/coder/'), project: 'agents/coder/tsconfig.json' },
  { test: file => file.startsWith('agents/reviewer/'), project: 'agents/reviewer/tsconfig.json' },
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
    test: file => file.startsWith('apps/frontend/knowledge/src/') || file.startsWith('apps/frontend/knowledge/test/'),
    project: 'apps/frontend/knowledge/tsconfig.app.json'
  },
  {
    test: file => file === 'apps/frontend/agent-chat/vite.config.ts',
    project: 'apps/frontend/agent-chat/tsconfig.node.json'
  },
  {
    test: file => file === 'apps/frontend/knowledge/vite.config.ts',
    project: 'apps/frontend/knowledge/tsconfig.app.json'
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
  'eslint.config.js',
  'prettier.config.js',
  'vitest.config.js'
];

const FULL_RELATED_TEST_TRIGGERS = [...FULL_TYPECHECK_TRIGGERS, 'vitest.workspace.ts', 'vitest.workspace.js'];
const COVERAGE_OPT_IN_ENV = 'CHECK_STAGED_WITH_COVERAGE';
const PROMPT_REGRESSION_GLOBS = [
  /^packages\/evals\/promptfoo\//,
  /^scripts\/run-prompt-regression\.js$/,
  /^scripts\/prompt-regression\.(?:js|d\.ts)$/,
  /^agents\/.+\/prompts\//,
  /^packages\/.+\/prompts\//,
  /^apps\/.+\/prompts\//
];

const ALL_TYPECHECK_PROJECTS = [
  'packages/core/tsconfig.json',
  'packages/config/tsconfig.json',
  'packages/runtime/tsconfig.json',
  'packages/adapters/tsconfig.json',
  'packages/memory/tsconfig.json',
  'packages/evals/tsconfig.json',
  'packages/tools/tsconfig.json',

  'agents/supervisor/tsconfig.json',
  'agents/data-report/tsconfig.json',
  'agents/coder/tsconfig.json',
  'agents/reviewer/tsconfig.json',
  'apps/backend/agent-server/tsconfig.json',
  'apps/worker/tsconfig.json',
  'apps/frontend/agent-admin/tsconfig.app.json',
  'apps/frontend/agent-chat/tsconfig.app.json',
  'apps/frontend/agent-chat/tsconfig.node.json',
  'apps/frontend/knowledge/tsconfig.app.json'
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

function resolveTestRun(files) {
  const normalized = files.map(toPosix);
  const shouldRunAll = normalized.some(file => {
    if (FULL_RELATED_TEST_TRIGGERS.includes(file)) {
      return true;
    }

    return file.startsWith('.husky/') || file.startsWith('.github/workflows/') || file.startsWith('scripts/');
  });

  if (shouldRunAll) {
    return {
      mode: 'all',
      files: []
    };
  }

  const relatedFiles = normalized.filter(file => TEST_RELATED_EXTENSIONS.has(path.extname(file).toLowerCase()));
  if (relatedFiles.length === 0) {
    return {
      mode: 'none',
      files: []
    };
  }

  return {
    mode: 'related',
    files: relatedFiles
  };
}

export function resolvePromptRegressionRun(files) {
  const matchedFiles = unique(
    files.map(toPosix).filter(file => PROMPT_REGRESSION_GLOBS.some(pattern => pattern.test(file)))
  );

  return {
    required: matchedFiles.length > 0,
    files: matchedFiles
  };
}

function main() {
  const stagedFiles = getStagedFiles();

  if (stagedFiles.length === 0) {
    console.log('[check:staged] no staged files');
    return;
  }

  console.log('[check:staged] source artifact scan');
  run(process.execPath, [path.join(rootDir, 'scripts/check-source-artifacts.js')], { shell: false });

  const prettierFiles = stagedFiles.filter(file => PRETTIER_EXTENSIONS.has(path.extname(file).toLowerCase()));
  const eslintFiles = stagedFiles.filter(file => ESLINT_EXTENSIONS.has(path.extname(file).toLowerCase()));
  const typecheckProjects = resolveTypecheckProjects(stagedFiles);
  const testRun = resolveTestRun(stagedFiles);
  const promptRegressionRun = resolvePromptRegressionRun(stagedFiles);

  if (prettierFiles.length > 0) {
    console.log('[check:staged] prettier:', prettierFiles.length, 'files');
    run('pnpm', ['exec', 'prettier', '--write', ...prettierFiles]);
  }

  if (eslintFiles.length > 0) {
    console.log('[check:staged] eslint:', eslintFiles.length, 'files');
    run('pnpm', ['exec', 'eslint', '--fix', '--no-warn-ignored', ...eslintFiles]);
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

  if (testRun.mode === 'all') {
    console.log('[check:staged] tests: full vitest run');
    run('pnpm', ['exec', 'vitest', 'run', '--config', 'vitest.config.js']);
  } else if (testRun.mode === 'related') {
    console.log('[check:staged] tests: related vitest run for', testRun.files.length, 'files');
    run('pnpm', ['exec', 'vitest', 'related', '--run', '--config', 'vitest.config.js', ...testRun.files]);
  } else {
    console.log('[check:staged] no affected tests');
  }

  if (process.env[COVERAGE_OPT_IN_ENV] === '1') {
    console.log('[check:staged] coverage: full vitest coverage run');
    run('pnpm', ['exec', 'vitest', 'run', '--config', 'vitest.config.js', '--coverage']);
  } else {
    console.log(`[check:staged] coverage skipped (set ${COVERAGE_OPT_IN_ENV}=1 to enable)`);
  }

  if (promptRegressionRun.required) {
    console.log('[check:staged] prompt regression:', promptRegressionRun.files.length, 'prompt-related files');
    run(process.execPath, [path.join(rootDir, 'scripts/run-prompt-regression.js')], { shell: false });
  } else {
    console.log('[check:staged] prompt regression skipped');
  }

  if (
    stagedFiles.some(
      file =>
        file.startsWith('apps/backend/agent-server/src/') ||
        file.startsWith('apps/backend/agent-server/test/') ||
        file.startsWith('apps/worker/src/') ||
        file.startsWith('apps/worker/test/')
    )
  ) {
    console.log('[check:staged] backend structure check');
    run(process.execPath, [path.join(rootDir, 'scripts/check-backend-structure.js')], { shell: false });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
