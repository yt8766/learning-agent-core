import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ignoredDirs = new Set(['node_modules', 'build', 'dist', '.turbo', '.git']);
const sourceExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mts', '.cts', '.mjs', '.cjs']);
const namedBarrelDirs = new Set(['repositories', 'search', 'vector', 'embeddings', 'approval', 'watchdog']);

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) {
    return files;
  }

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignoredDirs.has(entry.name)) {
      continue;
    }

    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, files);
      continue;
    }

    if (sourceExtensions.has(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }

  return files;
}

function toRepoPath(filePath) {
  return path.relative(rootDir, filePath).replace(/\\/g, '/');
}

function main() {
  const files = [
    ...walk(path.join(rootDir, 'packages')),
    ...walk(path.join(rootDir, 'agents')),
    ...walk(path.join(rootDir, 'apps'))
  ];
  const violations = [];

  for (const filePath of files) {
    if (path.basename(filePath) !== 'index.ts') {
      continue;
    }

    const repoPath = toRepoPath(filePath);
    const dirName = path.basename(path.dirname(filePath));
    if (!namedBarrelDirs.has(dirName)) {
      continue;
    }

    const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
    lines.forEach((line, index) => {
      if (/^\s*export\s+.*from\s+['"]\.\.\//.test(line)) {
        violations.push(
          `${repoPath}:${index + 1} uses parent re-export in ${dirName}/index.ts; move implementation files into the directory`
        );
      }
    });
  }

  if (violations.length > 0) {
    console.error('[barrel-layout] found barrel layout violations:\n');
    for (const violation of violations) {
      console.error(`- ${violation}`);
    }
    process.exit(1);
  }

  console.log('[barrel-layout] barrel layout OK');
}

main();
