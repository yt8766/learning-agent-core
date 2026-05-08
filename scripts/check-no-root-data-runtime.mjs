#!/usr/bin/env node
/* global console, process */
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const ROOT = process.cwd();
const SCAN_ROOTS = ['apps', 'packages', 'agents'];
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs']);
const FORBIDDEN_ROOT_DATA_SEGMENTS = 'runtime|memory|knowledge|skills|browser-replays|generated';

const PATTERNS = [
  {
    id: 'root-data-string-literal',
    regex: new RegExp(`['"\`]data\\/(?:${FORBIDDEN_ROOT_DATA_SEGMENTS})\\b`, 'g')
  },
  {
    id: 'root-data-path-join',
    regex: new RegExp(
      `\\b(?:join|resolve)\\([^;\\n]*(?:['"\`]data\\/(?:${FORBIDDEN_ROOT_DATA_SEGMENTS})|['"\`]data['"\`]\\s*,\\s*['"\`](?:${FORBIDDEN_ROOT_DATA_SEGMENTS}))`,
      'g'
    )
  },
  {
    id: 'root-data-workspace-path',
    regex: new RegExp(`\\btoWorkspacePath\\([^;\\n]*['"\`]data\\/(?:${FORBIDDEN_ROOT_DATA_SEGMENTS})`, 'g')
  }
];

const ALLOWLIST = [
  [
    'apps/backend/agent-server/scripts/cleanup-agent-server-artifacts.mjs',
    'App-local cleanup may inspect legacy root data during migration.'
  ],
  [
    'packages/templates/src/registries/frontend-template-registry.ts',
    'Template registry may describe generated app paths.'
  ]
];

const allowlist = new Map(ALLOWLIST);

function isSourceFile(path) {
  const extension = path.slice(path.lastIndexOf('.'));
  return SOURCE_EXTENSIONS.has(extension) && !path.includes('/test/') && !path.includes('/tests/');
}

function isTemplateInternalDataPath(matchText) {
  return /['"`]src['"`]\s*,\s*['"`]services['"`]\s*,\s*['"`]data['"`]/.test(matchText);
}

function filterMatches(patternId, matches) {
  if (patternId !== 'root-data-path-join') {
    return matches;
  }

  return matches.filter(match => !isTemplateInternalDataPath(match[0]));
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
    const matches = filterMatches(pattern.id, [...text.matchAll(pattern.regex)]);
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
