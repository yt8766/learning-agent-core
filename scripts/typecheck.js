import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tsc = path.join(rootDir, 'node_modules/typescript/lib/tsc.js');

const appProjects = [
  'apps/backend/agent-server/tsconfig.json',
  'apps/frontend/agent-admin/tsconfig.json',
  'apps/frontend/agent-admin/tsconfig.node.json',
  'apps/frontend/agent-chat/tsconfig.app.json',
  'apps/frontend/agent-chat/tsconfig.node.json',
  'apps/frontend/knowledge/tsconfig.app.json'
];
const projects = [...collectPackageProjects('packages'), ...collectPackageProjects('agents'), ...appProjects];

if (!fs.existsSync(tsc)) {
  console.error('typescript not found at', tsc);
  process.exit(1);
}

for (const rel of projects) {
  const configPath = path.join(rootDir, rel);
  if (!fs.existsSync(configPath)) {
    console.warn('[typecheck] skip (missing):', rel);
    continue;
  }
  const r = spawnSync(process.execPath, [tsc, '--noEmit', '-p', configPath], {
    stdio: 'inherit',
    cwd: rootDir
  });
  if (r.status !== 0) {
    process.exit(r.status ?? 1);
  }
}

console.log('[typecheck] ok:', projects.length, 'projects');

function collectPackageProjects(rootSegment) {
  const segmentRoot = path.join(rootDir, rootSegment);
  if (!fs.existsSync(segmentRoot)) {
    return [];
  }

  return fs
    .readdirSync(segmentRoot, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => `${rootSegment}/${entry.name}/tsconfig.json`)
    .filter(relPath => fs.existsSync(path.join(rootDir, relPath)))
    .sort((left, right) => left.localeCompare(right));
}
