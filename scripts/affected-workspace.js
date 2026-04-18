import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const DEFAULT_AFFECTED_BASE_REF = 'origin/main';

export const PRETTIER_EXTENSIONS = new Set([
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

export const ESLINT_EXTENSIONS = new Set(['.js', '.ts', '.tsx', '.mjs', '.cjs']);

export const GLOBAL_LINT_IMPACT_PATHS = new Set([
  'package.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  'eslint.config.js',
  'prettier.config.js'
]);

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const defaultRepoRoot = path.resolve(scriptDir, '..');

export function resolveAffectedBaseRef(env = process.env) {
  const configured = env.VERIFY_BASE_REF?.trim();
  return configured || DEFAULT_AFFECTED_BASE_REF;
}

export function buildTurboAffectedFilter(baseRef = resolveAffectedBaseRef()) {
  return `...[${baseRef}]`;
}

export function readChangedPaths(options = {}) {
  const repoRoot = options.repoRoot ?? defaultRepoRoot;
  const baseRef = options.baseRef ?? resolveAffectedBaseRef();
  const changedPaths = new Set();
  let hasReadableSignal = false;

  for (const args of [
    ['diff', '--name-only', `${baseRef}...HEAD`],
    ['diff', '--name-only'],
    ['diff', '--name-only', '--cached'],
    ['ls-files', '--others', '--exclude-standard']
  ]) {
    const output = readGitPathSet(repoRoot, args);
    if (!output) {
      continue;
    }

    hasReadableSignal = true;
    for (const relativePath of output) {
      changedPaths.add(normalizeRepoRelativePath(relativePath));
    }
  }

  return {
    baseRef,
    hasReadableSignal,
    paths: [...changedPaths].sort((left, right) => left.localeCompare(right))
  };
}

export function resolveAffectedLintFiles(changedPaths, tool, options = {}) {
  const repoRoot = options.repoRoot ?? defaultRepoRoot;
  const normalizedPaths = [...new Set(changedPaths.map(normalizeRepoRelativePath))].filter(Boolean);

  if (normalizedPaths.some(pathname => GLOBAL_LINT_IMPACT_PATHS.has(pathname))) {
    return {
      mode: 'all',
      files: []
    };
  }

  const extensions = tool === 'eslint' ? ESLINT_EXTENSIONS : PRETTIER_EXTENSIONS;
  const files = normalizedPaths.filter(relativePath => {
    if (!extensions.has(path.extname(relativePath).toLowerCase())) {
      return false;
    }

    return fs.existsSync(path.join(repoRoot, relativePath));
  });

  if (files.length === 0) {
    return {
      mode: 'none',
      files: []
    };
  }

  return {
    mode: 'targeted',
    files
  };
}

export function normalizeRepoRelativePath(filePath) {
  return filePath.replace(/\\/g, '/');
}

function readGitPathSet(repoRoot, args) {
  const result = spawnSync('git', args, {
    cwd: repoRoot,
    encoding: 'utf8'
  });

  if (result.status !== 0) {
    return null;
  }

  return String(result.stdout)
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);
}
