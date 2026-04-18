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
  'apps/frontend/agent-admin/test',
  'apps/frontend/agent-chat/src',
  'apps/frontend/agent-chat/test',
  'apps/worker/src',
  'apps/worker/test'
];
const publicEntryRoots = [
  'packages/core/test',
  'packages/core/src',
  'packages/runtime/test',
  'packages/runtime/src',
  'packages/adapters/test',
  'packages/adapters/src',
  'agents/supervisor/test',
  'agents/supervisor/src',
  'agents/data-report/test',
  'agents/data-report/src',
  'agents/coder/test',
  'agents/coder/src',
  'agents/reviewer/test',
  'agents/reviewer/src',
  'packages/memory/test',
  'packages/memory/src',
  'packages/tools/src',
  'packages/tools/test',
  'packages/skill-runtime/src',
  'packages/skill-runtime/test',
  'apps/backend/agent-server/src',
  'apps/backend/agent-server/test'
];

const forbiddenSubpathPrefixes = [
  '@agent/config/',
  '@agent/memory/',
  '@agent/runtime/',
  '@agent/adapters/',
  '@agent/tools/',
  '@agent/core/',
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

function isWorkspaceSourcePath(source) {
  return /(?:^|\/)(packages|agents)\/[^'"]+\/src(?:\/|$)/.test(source);
}

function isAgentPackageSubpath(source) {
  return /^@agent\/[^/'"]+\/.+/.test(source);
}

export function findBoundaryViolations(scanRoot = rootDir) {
  const files = [
    ...walk(path.join(scanRoot, 'packages')),
    ...walk(path.join(scanRoot, 'agents')),
    ...walk(path.join(scanRoot, 'apps'))
  ];
  const violations = [];

  for (const filePath of files) {
    const repoPath = path.relative(scanRoot, filePath).replace(/\\/g, '/');
    const text = fs.readFileSync(filePath, 'utf8');
    const sources = extractImportSources(text);

    for (const source of sources) {
      if (isUnderRoots(repoPath, appRoots)) {
        if (isWorkspaceSourcePath(source)) {
          violations.push(`${repoPath} imports workspace source path "${source}" from app code`);
        }

        if (isAgentPackageSubpath(source)) {
          violations.push(`${repoPath} imports package subpath "${source}" from app code`);
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

  return violations;
}

function main() {
  const violations = findBoundaryViolations();

  if (violations.length === 0) {
    console.log('[package-boundaries] package boundaries OK');
    return;
  }

  fail(violations);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
