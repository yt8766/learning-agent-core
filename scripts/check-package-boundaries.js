import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceFilePattern = /\.(?:[cm]?[jt]sx?)$/;
const ignoredDirs = new Set(['node_modules', 'build', 'dist', '.turbo', '.git']);

const appRoots = [
  'apps/backend/agent-server/src',
  'apps/backend/agent-server/test',
  'apps/frontend/agent-admin/src',
  'apps/frontend/agent-chat/src',
  'apps/worker/src',
  'apps/worker/test'
];
const publicEntryRoots = [
  'packages/core/src',
  'packages/runtime/src',
  'packages/adapters/src',
  'agents/supervisor/src',
  'agents/data-report/src',
  'agents/coder/src',
  'agents/reviewer/src',
  'packages/model/src',
  'packages/memory/src',
  'packages/tools/src',
  'packages/tools/test',
  'packages/skills/src',
  'packages/skills/test',
  'apps/backend/agent-server/src',
  'apps/backend/agent-server/test'
];

const forbiddenRootEntrypoints = new Set();
const forbiddenSubpathPrefixes = [
  '@agent/config/',
  '@agent/memory/',
  '@agent/model/',
  '@agent/runtime/',
  '@agent/adapters/',
  '@agent/tools/',
  '@agent/agents-supervisor/',
  '@agent/agents-data-report/',
  '@agent/agents-coder/',
  '@agent/agents-reviewer/'
];

function fail(messages) {
  if (messages.length === 0) {
    return;
  }

  console.error('[package-boundaries] found architecture boundary violations:\n');
  for (const message of messages) {
    console.error(`- ${message}`);
  }
  process.exit(1);
}

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

    if (sourceFilePattern.test(entry.name)) {
      files.push(fullPath);
    }
  }

  return files;
}

function toRepoPath(filePath) {
  return path.relative(rootDir, filePath).replace(/\\/g, '/');
}

function extractImportSources(text) {
  const sources = [];
  const patterns = [/\bfrom\s+['"]([^'"]+)['"]/g, /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      sources.push(match[1]);
    }
  }

  return sources;
}

function isUnderRoots(repoPath, roots) {
  return roots.some(root => repoPath === root || repoPath.startsWith(`${root}/`));
}

function main() {
  const files = [
    ...walk(path.join(rootDir, 'packages')),
    ...walk(path.join(rootDir, 'agents')),
    ...walk(path.join(rootDir, 'apps'))
  ];
  const violations = [];

  for (const filePath of files) {
    const repoPath = toRepoPath(filePath);
    const text = fs.readFileSync(filePath, 'utf8');
    const sources = extractImportSources(text);

    for (const source of sources) {
      if (isUnderRoots(repoPath, appRoots)) {
        if (source.includes('/packages/') && source.includes('/src')) {
          violations.push(`${repoPath} imports workspace source path "${source}" from app code`);
        }

        if (/^@agent\/[^'"]+\/src(?:\/|$)/.test(source)) {
          violations.push(`${repoPath} imports deep package source "${source}" from app code`);
        }
      }

      if (
        isUnderRoots(repoPath, publicEntryRoots) &&
        forbiddenSubpathPrefixes.some(prefix => source.startsWith(prefix))
      ) {
        violations.push(`${repoPath} imports subpath entry "${source}" where the package root entry should be used`);
      }
    }
  }

  if (violations.length === 0) {
    console.log('[package-boundaries] package boundaries OK');
    return;
  }

  fail(violations);
}

main();
