#!/usr/bin/env node
/* global console, process */
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const ROOT = process.cwd();
const SCAN_ROOTS = ['apps', 'packages', 'agents'];
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs']);

const PATTERNS = [
  {
    id: 'root-data-string-literal',
    regex: /['"`]data\/(?:runtime|memory|knowledge|skills|browser-replays|generated|agent-personal|agent-work)\b/g
  },
  {
    id: 'root-data-path-join',
    regex:
      /\b(?:join|resolve)\([^;\n]*(?:['"`]data\/(?:runtime|memory|knowledge|skills|browser-replays|generated)|['"`]data['"`]\s*,\s*['"`](?:runtime|memory|knowledge|skills|browser-replays|generated))/g
  },
  {
    id: 'root-data-workspace-path',
    regex: /\btoWorkspacePath\([^;\n]*['"`]data\/(?:runtime|memory|knowledge|skills|browser-replays|generated)/g
  }
];

const ALLOWLIST = [
  [
    'apps/backend/agent-server/scripts/cleanup-agent-server-artifacts.mjs',
    'App-local cleanup may inspect legacy root data during migration.'
  ],
  [
    'apps/backend/agent-server/src/runtime/centers/runtime-centers-observability.query-service.ts',
    'Pending Phase 6 browser replay artifact repository cutover.'
  ],
  [
    'apps/backend/agent-server/src/runtime/centers/runtime-centers-workspace-drafts.ts',
    'Pending Phase 3 workspace draft persistence cutover.'
  ],
  ['apps/backend/agent-server/src/runtime/core/runtime-intel-runner.ts', 'Pending Phase 5 intel persistence cutover.'],
  [
    'apps/backend/agent-server/src/runtime/skills/runtime-skill-install.service.ts',
    'Pending Phase 3 skill install staging storage cutover.'
  ],
  [
    'apps/backend/agent-server/src/runtime/skills/skill-source-sync.service.ts',
    'Pending Phase 3 skill source sync storage cutover.'
  ],
  ['packages/config/src/shared/settings-defaults.ts', 'Pending Phase 7 config default cutover from root data paths.'],
  [
    'packages/config/src/profiles/runtime-profile-overrides.ts',
    'Pending Phase 7 profile config default cutover from root data paths.'
  ],
  [
    'packages/skill/src/install/skill-artifact-fetcher.ts',
    'Pending Phase 3 skill artifact staging/draft storage cutover.'
  ],
  [
    'packages/runtime/src/sandbox/sandbox-executor-skill-search.ts',
    'Pending Phase 3 sandbox skill search metadata cutover.'
  ],
  [
    'packages/runtime/src/sandbox/sandbox-executor-browser.ts',
    'Pending Phase 6 browser replay artifact repository cutover.'
  ],
  ['packages/runtime/src/sandbox/sandbox-executor.ts', 'Pending Phase 6 generated artifact repository cutover.'],
  ['packages/knowledge/src/runtime/local-knowledge-store.ts', 'Pending Phase 5 knowledge snapshot repository cutover.'],
  ['packages/report-kit/src/blueprints/data-report-blueprint.ts', 'Pending Phase 6 report generated artifact cutover.'],
  [
    'packages/templates/src/registries/frontend-template-registry.ts',
    'Pending Phase 6 frontend template output cutover.'
  ],
  ['packages/tools/src/executors/connectors/connectors-executor.ts', 'Pending Phase 5 connector persistence cutover.'],
  [
    'packages/tools/src/executors/runtime-governance/runtime-governance-executor.ts',
    'Pending Phase 5 runtime governance persistence cutover.'
  ],
  ['packages/tools/src/executors/scheduling/scheduling-executor.ts', 'Pending Phase 5 scheduling persistence cutover.'],
  ['agents/coder/src/flows/chat/nodes/executor-node-tooling.ts', 'Pending Phase 6 generated artifact cutover.'],
  [
    'agents/coder/src/flows/ministries/gongbu-code/gongbu-code-tool-resolution.ts',
    'Pending Phase 6 Gongbu generated artifact defaults cutover.'
  ],
  [
    'agents/data-report/src/flows/data-report-json/runtime-cache.ts',
    'Pending Phase 6 data-report JSON artifact cache cutover.'
  ],
  ['agents/intel-engine/src/runtime/briefing/briefing-paths.ts', 'Pending Phase 5 intel briefing persistence cutover.'],
  [
    'agents/intel-engine/src/runtime/briefing/briefing-storage.ts',
    'Pending Phase 5 intel briefing persistence cutover.'
  ]
];

const allowlist = new Map(ALLOWLIST);

function isSourceFile(path) {
  const extension = path.slice(path.lastIndexOf('.'));
  return SOURCE_EXTENSIONS.has(extension) && !path.includes('/test/') && !path.includes('/tests/');
}

async function listFiles(dir) {
  const output = [];
  let entries;
  try {
    entries = await readdir(join(ROOT, dir), { withFileTypes: true });
  } catch {
    return output;
  }

  for (const entry of entries) {
    const relativePath = join(dir, entry.name);
    if (entry.name === 'node_modules' || entry.name === 'build' || entry.name === 'dist') {
      continue;
    }
    if (entry.isDirectory()) {
      output.push(...(await listFiles(relativePath)));
    } else if (isSourceFile(relativePath)) {
      output.push(relativePath);
    }
  }
  return output;
}

const files = (await Promise.all(SCAN_ROOTS.map(listFiles))).flat();
const failures = [];
const transitional = [];

for (const file of files) {
  const text = await readFile(join(ROOT, file), 'utf8');
  for (const pattern of PATTERNS) {
    const matches = [...text.matchAll(pattern.regex)];
    if (matches.length === 0) {
      continue;
    }
    const reason = allowlist.get(file);
    const record = {
      file,
      pattern: pattern.id,
      count: matches.length,
      reason
    };
    if (reason) {
      transitional.push(record);
    } else {
      failures.push(record);
    }
  }
}

if (transitional.length > 0) {
  console.warn('[check-no-root-data-runtime] transitional root data hits remain:');
  for (const hit of transitional) {
    console.warn(`- ${hit.file} [${hit.pattern}] ${hit.count} hit(s): ${hit.reason}`);
  }
}

if (failures.length > 0) {
  console.error('[check-no-root-data-runtime] unexpected root data runtime hits:');
  for (const hit of failures) {
    console.error(`- ${hit.file} [${hit.pattern}] ${hit.count} hit(s)`);
  }
  process.exit(1);
}

console.log('[check-no-root-data-runtime] OK');
