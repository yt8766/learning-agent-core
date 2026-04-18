import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const lockfilePath = path.join(rootDir, 'pnpm-lock.yaml');
const workspacePath = path.join(rootDir, 'pnpm-workspace.yaml');

if (!existsSync(lockfilePath)) {
  console.error('pnpm-lock.yaml is missing. Run `pnpm install` and commit the generated lockfile.');
  process.exit(1);
}

if (!existsSync(workspacePath)) {
  console.error('pnpm-workspace.yaml is missing. Cannot validate workspace importers.');
  process.exit(1);
}

const lockfileText = readFileSync(lockfilePath, 'utf8');
const workspaceText = readFileSync(workspacePath, 'utf8');

const workspacePatterns = workspaceText
  .split('\n')
  .map(line => line.trim())
  .filter(line => line.startsWith('- '))
  .map(line =>
    line
      .slice(2)
      .trim()
      .replace(/^['"]|['"]$/g, '')
  )
  .filter(Boolean);

const packageJsonPaths = new Set(['package.json']);

for (const pattern of workspacePatterns) {
  if (pattern.endsWith('/*')) {
    const baseDir = pattern.slice(0, -2);
    const absoluteBaseDir = path.join(rootDir, baseDir);
    if (!existsSync(absoluteBaseDir)) {
      continue;
    }

    for (const entry of readDirNames(absoluteBaseDir)) {
      packageJsonPaths.add(path.posix.join(baseDir, entry, 'package.json'));
    }
    continue;
  }

  packageJsonPaths.add(path.posix.join(pattern, 'package.json'));
}

const mismatches = [];

for (const packageJsonPath of packageJsonPaths) {
  const absolutePackageJsonPath = path.join(rootDir, packageJsonPath);
  if (!existsSync(absolutePackageJsonPath)) {
    continue;
  }

  const packageJson = JSON.parse(readFileSync(absolutePackageJsonPath, 'utf8'));
  const importerPath = packageJsonPath === 'package.json' ? '.' : path.posix.dirname(packageJsonPath);
  const importerBlock = getImporterBlock(lockfileText, importerPath);

  if (!importerBlock) {
    mismatches.push(`${importerPath}: importer entry is missing from pnpm-lock.yaml`);
    continue;
  }

  for (const section of ['dependencies', 'devDependencies', 'optionalDependencies']) {
    const packageDeps = packageJson[section] ?? {};
    const lockfileDeps = getSectionSpecifiers(importerBlock, section);

    for (const [name, specifier] of Object.entries(packageDeps)) {
      if (!(name in lockfileDeps)) {
        mismatches.push(
          `${importerPath}: ${section}.${name} is missing from pnpm-lock.yaml (package.json=${specifier})`
        );
        continue;
      }

      if (lockfileDeps[name] !== specifier) {
        mismatches.push(
          `${importerPath}: ${section}.${name} specifier mismatch (package.json=${specifier}, lockfile=${lockfileDeps[name]})`
        );
      }
    }
  }
}

if (mismatches.length > 0) {
  console.error('pnpm-lock.yaml is out of sync with one or more workspace package.json files.');
  console.error('');
  for (const mismatch of mismatches) {
    console.error(`- ${mismatch}`);
  }
  console.error('');
  console.error(
    'Why this check exists: CI uses `pnpm install --frozen-lockfile`, so manifest/lockfile drift will always fail later installs.'
  );
  console.error(
    'How to fix it: run `pnpm install` locally, review the lockfile diff, and commit `pnpm-lock.yaml` together with the manifest change.'
  );
  console.error(
    'Why not use `--no-frozen-lockfile`: that would hide the drift and make CI mutate dependency state instead of validating it.'
  );
  process.exit(1);
}

console.log('pnpm-lock.yaml is in sync with workspace package manifests.');

function readDirNames(directoryPath) {
  return readdirSync(directoryPath, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .filter(entry => !entry.name.startsWith('.'))
    .map(entry => entry.name);
}

function getImporterBlock(lockfile, importerPath) {
  const escapedPath = escapeRegExp(importerPath);
  const importerStart = new RegExp(`^  ${escapedPath}:(?: \\{\\})?\\n`, 'm');
  const match = importerStart.exec(lockfile);

  if (!match) {
    return null;
  }

  if (match[0].includes('{}')) {
    return match[0];
  }

  const startIndex = match.index;
  const rest = lockfile.slice(startIndex);
  const nextImporterIndex = rest.slice(match[0].length).search(/^ {2}[^\s][^:]*:\n/m);

  if (nextImporterIndex === -1) {
    return rest;
  }

  return rest.slice(0, match[0].length + nextImporterIndex);
}

function getSectionSpecifiers(importerBlock, sectionName) {
  const sectionStart = new RegExp(`^    ${escapeRegExp(sectionName)}:\\n`, 'm');
  const match = sectionStart.exec(importerBlock);

  if (!match) {
    return {};
  }

  const rest = importerBlock.slice(match.index);
  const nextSectionIndex = rest.slice(match[0].length).search(/^ {4}[A-Za-z][A-Za-z]+:\n/m);
  const sectionBlock = nextSectionIndex === -1 ? rest : rest.slice(0, match[0].length + nextSectionIndex);

  const specifiers = {};
  const dependencyPattern = /^ {6}(.+?):\n {8}specifier: (.+)\n/gm;

  for (const dependencyMatch of sectionBlock.matchAll(dependencyPattern)) {
    const rawName = dependencyMatch[1].trim();
    const name = rawName.replace(/^['"]|['"]$/g, '');
    specifiers[name] = dependencyMatch[2].trim();
  }

  return specifiers;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
