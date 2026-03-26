import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { rm } from 'node:fs/promises';

const rootDir = process.cwd();
const packagesDir = path.join(rootDir, 'packages');
const args = process.argv.slice(2);
const forbiddenCleanupTargets = [
  path.join(process.env.HOME ?? '', 'Library', 'Application Support', 'Google', 'Chrome'),
  path.join(process.env.HOME ?? '', 'Library', 'Caches', 'Google', 'Chrome')
].filter(Boolean);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, ''));
}

function parseArgs(argv) {
  const filters = [];
  let command = 'clean';
  let cleanDist = true;
  let cleanBuild = true;
  let dryRun = false;
  let all = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg) {
      continue;
    }

    if (!arg.startsWith('-') && command === 'clean' && filters.length === 0 && arg === 'clean') {
      command = 'clean';
      continue;
    }

    if (arg === '--filter' || arg === '-f') {
      const next = argv[index + 1];
      if (!next) {
        throw new Error('missing value for --filter');
      }
      filters.push(next);
      index += 1;
      continue;
    }

    if (arg.startsWith('--filter=')) {
      filters.push(arg.slice('--filter='.length));
      continue;
    }

    if (arg === '--all') {
      all = true;
      continue;
    }

    if (arg === '--dry-run') {
      dryRun = true;
      continue;
    }

    if (arg === '--no-dist') {
      cleanDist = false;
      continue;
    }

    if (arg === '--no-build') {
      cleanBuild = false;
      continue;
    }

    if (!arg.startsWith('-')) {
      filters.push(arg);
      continue;
    }

    throw new Error(`unknown argument: ${arg}`);
  }

  return {
    command,
    filters,
    cleanDist,
    cleanBuild,
    dryRun,
    all
  };
}

function readWorkspacePackages() {
  if (!fs.existsSync(packagesDir)) {
    return [];
  }

  return fs
    .readdirSync(packagesDir, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => {
      const dir = path.join(packagesDir, entry.name);
      const packageJsonPath = path.join(dir, 'package.json');
      if (!fs.existsSync(packageJsonPath)) {
        return null;
      }

      const packageJson = readJson(packageJsonPath);
      const scripts = packageJson.scripts ?? {};
      const supportsBuild = Boolean(
        scripts['build:lib'] || scripts.build || fs.existsSync(path.join(dir, 'tsup.config.ts'))
      );

      return {
        dir,
        folderName: entry.name,
        packageName: packageJson.name,
        supportsBuild
      };
    })
    .filter(Boolean);
}

function resolveTargets(options, workspaces) {
  if (options.all || options.filters.length === 0) {
    return workspaces.filter(workspace => workspace.supportsBuild);
  }

  const normalizedFilters = new Set(options.filters);
  const targets = workspaces.filter(
    workspace => normalizedFilters.has(workspace.folderName) || normalizedFilters.has(workspace.packageName)
  );

  const missing = options.filters.filter(
    filter => !targets.some(workspace => workspace.folderName === filter || workspace.packageName === filter)
  );

  if (missing.length > 0) {
    throw new Error(`unknown package filter: ${missing.join(', ')}`);
  }

  return targets.filter(workspace => workspace.supportsBuild);
}

async function removeIfExists(targetPath, dryRun) {
  if (!fs.existsSync(targetPath)) {
    return false;
  }

  const normalizedTarget = path.resolve(targetPath);
  for (const forbiddenTarget of forbiddenCleanupTargets) {
    const normalizedForbidden = path.resolve(forbiddenTarget);
    if (normalizedTarget === normalizedForbidden || normalizedTarget.startsWith(`${normalizedForbidden}${path.sep}`)) {
      throw new Error(`refusing to clean protected path: ${normalizedTarget}`);
    }
  }

  if (dryRun) {
    return true;
  }

  await rm(targetPath, { recursive: true, force: true });
  return true;
}

async function cleanWorkspace(workspace, options) {
  const removed = [];

  if (options.cleanBuild) {
    const buildPath = path.join(workspace.dir, 'build');
    if (await removeIfExists(buildPath, options.dryRun)) {
      removed.push(path.relative(rootDir, buildPath));
    }
  }

  if (options.cleanDist) {
    const distPath = path.join(workspace.dir, 'dist');
    if (await removeIfExists(distPath, options.dryRun)) {
      removed.push(path.relative(rootDir, distPath));
    }
  }

  return removed;
}

async function main() {
  const options = parseArgs(args);
  if (options.command !== 'clean') {
    throw new Error(`unsupported command: ${options.command}`);
  }

  const workspaces = readWorkspacePackages();
  const targets = resolveTargets(options, workspaces);

  if (targets.length === 0) {
    console.log('[build.js] no matching buildable packages');
    return;
  }

  if (forbiddenCleanupTargets.length > 0) {
    console.log(
      `[build.js] protected cleanup paths: ${forbiddenCleanupTargets.map(target => path.relative(rootDir, target) || target).join(', ')}`
    );
  }

  const results = await Promise.all(
    targets.map(async workspace => ({
      workspace,
      removed: await cleanWorkspace(workspace, options)
    }))
  );

  for (const result of results) {
    const label = `${result.workspace.folderName}${result.workspace.packageName ? ` (${result.workspace.packageName})` : ''}`;
    if (result.removed.length === 0) {
      console.log(`[build.js] skip ${label}`);
      continue;
    }

    const action = options.dryRun ? 'would remove' : 'removed';
    console.log(`[build.js] ${action} ${label}: ${result.removed.join(', ')}`);
  }
}

main().catch(error => {
  console.error('[build.js]', error instanceof Error ? error.message : error);
  process.exit(1);
});
