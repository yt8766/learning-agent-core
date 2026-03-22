import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tsc = path.join(rootDir, 'node_modules/typescript/lib/tsc.js');

const projects = [
  'packages/config/tsconfig.json',
  'packages/shared/tsconfig.json',
  'packages/memory/tsconfig.json',
  'packages/evals/tsconfig.json',
  'packages/tools/tsconfig.json',
  'packages/skills/tsconfig.json',
  'packages/agent-core/tsconfig.json',
  'apps/backend/agent-server/tsconfig.json',
  'apps/worker/tsconfig.json',
  'apps/frontend/agent-admin/tsconfig.json',
  'apps/frontend/agent-chat/tsconfig.app.json',
  'apps/frontend/agent-chat/tsconfig.node.json'
];

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
