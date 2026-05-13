import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { readChangedPaths as readAffectedWorkspacePaths } from './affected-workspace.js';

const SKIP_DIRECTORY_NAMES = new Set(['node_modules', '.git', '.turbo', 'build', 'dist', 'coverage', 'data']);
const SPEC_FILE_NAME_PATTERN = /(schema|schemas|contract|contracts|parser|parsers|normalization|normalizer)/i;
const SPEC_SOURCE_PATTERN = /from\s+['"]zod(?:\/v4)?['"]|(?:[A-Za-z0-9_]*Schema)\.(?:parse|safeParse)\(|\bsafeParse\(/;

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const rawArgs = process.argv.slice(2);
const affectedOnly = rawArgs.includes('--affected');
const explicitTargets = rawArgs.filter(arg => arg !== '--affected');

const workspaceRoots = discoverWorkspaceRoots();
const targetRoots = resolveTargetRoots({
  affectedOnly,
  explicitTargets,
  workspaceRoots
});
const specFiles = collectSpecFiles(targetRoots);

if (specFiles.length === 0) {
  const scopeLabel = affectedOnly ? ' for affected scope' : '';
  console.log(`[spec] no matching spec tests found${scopeLabel}`);
  process.exit(0);
}

const result = spawnSync('pnpm', ['exec', 'vitest', 'run', '--config', 'vitest.config.js', ...specFiles], {
  cwd: repoRoot,
  stdio: 'inherit'
});

if (typeof result.status === 'number') {
  process.exit(result.status);
}

process.exit(1);

function resolveTargetRoots(params) {
  if (params.explicitTargets.length > 0) {
    return normalizeExplicitTargets(params.explicitTargets);
  }

  if (params.affectedOnly) {
    return resolveAffectedWorkspaceRoots(params.workspaceRoots);
  }

  return params.workspaceRoots;
}

function normalizeExplicitTargets(targets) {
  return [...new Set(targets.map(target => toRepoRelativePath(target)).filter(Boolean))].sort((left, right) =>
    left.localeCompare(right)
  );
}

function resolveAffectedWorkspaceRoots(workspaceRoots) {
  const changedPaths = readChangedPathsForSpecScope();

  if (!changedPaths) {
    return workspaceRoots;
  }

  if (changedPaths.some(isGlobalSpecImpactPath)) {
    console.log('[spec] global verification inputs changed; running all workspace spec tests');
    return workspaceRoots;
  }

  const impactedRoots = new Set();
  const sortedRoots = [...workspaceRoots].sort((left, right) => right.length - left.length);

  for (const changedPath of changedPaths) {
    for (const workspaceRoot of sortedRoots) {
      if (changedPath === workspaceRoot || changedPath.startsWith(`${workspaceRoot}/`)) {
        impactedRoots.add(workspaceRoot);
        break;
      }
    }
  }

  return [...impactedRoots].sort((left, right) => left.localeCompare(right));
}

function readChangedPathsForSpecScope() {
  const changed = readChangedPathsFromWorkspace();

  if (!changed.hasReadableSignal) {
    console.warn('[spec] unable to resolve affected files from git; falling back to full workspace');
    return null;
  }

  return changed.paths;
}

function readChangedPathsFromWorkspace() {
  return readAffectedWorkspacePaths({ repoRoot });
}

function isGlobalSpecImpactPath(relativePath) {
  return (
    relativePath === 'package.json' ||
    relativePath === 'pnpm-lock.yaml' ||
    relativePath === 'pnpm-workspace.yaml' ||
    relativePath === 'vitest.config.js' ||
    relativePath === 'scripts/run-spec-tests.js'
  );
}

function collectSpecFiles(targetRoots) {
  const files = [];

  for (const workspaceRoot of targetRoots) {
    const testRoot = path.join(repoRoot, workspaceRoot, 'test');

    if (!existsSync(testRoot)) {
      continue;
    }

    const projectFiles = [];
    collectProjectSpecFiles(testRoot, projectFiles);

    if (projectFiles.length === 0) {
      continue;
    }

    console.log(`[spec] ${workspaceRoot} -> ${projectFiles.length} files`);
    files.push(...projectFiles);
  }

  return files;
}

function collectProjectSpecFiles(directory, output) {
  const entries = readdirSync(directory);

  for (const entry of entries) {
    const absolutePath = path.join(directory, entry);
    const entryStats = statSync(absolutePath);

    if (entryStats.isDirectory()) {
      if (SKIP_DIRECTORY_NAMES.has(entry)) {
        continue;
      }
      collectProjectSpecFiles(absolutePath, output);
      continue;
    }

    if (!isVitestSourceFile(entry) || !isSpecTestSource(absolutePath, entry)) {
      continue;
    }

    output.push(path.relative(repoRoot, absolutePath));
  }
}

function isVitestSourceFile(filename) {
  return (
    /\.(test|spec)\.tsx?$/.test(filename) &&
    !/\.int-spec\.tsx?$/.test(filename) &&
    !/\.smoke\.spec\.tsx?$/.test(filename)
  );
}

function isSpecTestSource(absolutePath, filename) {
  if (SPEC_FILE_NAME_PATTERN.test(filename)) {
    return true;
  }

  const source = readFileSync(absolutePath, 'utf8');
  return SPEC_SOURCE_PATTERN.test(source);
}

function discoverWorkspaceRoots() {
  const roots = [];

  for (const segment of ['packages', 'agents', 'apps']) {
    const absoluteSegmentRoot = path.join(repoRoot, segment);

    if (!existsSync(absoluteSegmentRoot)) {
      continue;
    }

    collectWorkspaceRoots(absoluteSegmentRoot, roots);
  }

  return [...new Set(roots)].sort((left, right) => left.localeCompare(right));
}

function collectWorkspaceRoots(directory, output) {
  if (existsSync(path.join(directory, 'package.json'))) {
    output.push(path.relative(repoRoot, directory).replace(/\\/g, '/'));
    return;
  }

  const entries = readdirSync(directory);

  for (const entry of entries) {
    const absolutePath = path.join(directory, entry);
    const entryStats = statSync(absolutePath);

    if (!entryStats.isDirectory() || SKIP_DIRECTORY_NAMES.has(entry)) {
      continue;
    }

    collectWorkspaceRoots(absolutePath, output);
  }
}

function toRepoRelativePath(target) {
  const absoluteTarget = path.isAbsolute(target) ? target : path.resolve(repoRoot, target);
  return path.relative(repoRoot, absoluteTarget).replace(/\\/g, '/');
}
