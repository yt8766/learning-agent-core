import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const scanRoots = ['packages', 'agents'];
const ignoredDirs = new Set(['node_modules', 'build', 'dist', '.git', '.turbo']);
const generatedSourcePattern = /\.(?:d\.ts|js|js\.map)$/;

function walk(dir, results = []) {
  if (!fs.existsSync(dir)) {
    return results;
  }

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignoredDirs.has(entry.name)) {
      continue;
    }

    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, results);
      continue;
    }

    const repoPath = path.relative(rootDir, fullPath).replace(/\\/g, '/');
    if (!repoPath.includes('/src/')) {
      continue;
    }

    if (generatedSourcePattern.test(entry.name)) {
      results.push(repoPath);
    }
  }

  return results;
}

function main() {
  const artifacts = scanRoots.flatMap(root => walk(path.join(rootDir, root)));

  if (artifacts.length === 0) {
    console.log('[check-source-artifacts] OK');
    return;
  }

  console.error('[check-source-artifacts] generated build artifacts were found under source directories:\n');
  for (const file of artifacts) {
    console.error(`- ${file}`);
  }
  console.error(
    '\nExpected outputs belong in build/cjs, build/esm, or build/types, not packages/*/src or agents/*/src.'
  );
  process.exit(1);
}

main();
