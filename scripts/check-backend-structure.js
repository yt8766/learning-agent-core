import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const backendRoot = path.join(rootDir, 'apps/backend/agent-server/src');
const backendTestRoot = path.join(rootDir, 'apps/backend/agent-server/test');
const allowedModuleSubdirs = new Set(['dto', 'entities', 'interfaces']);
const legacyModuleDirs = new Set(['app', 'cors', 'logger', 'platform', 'runtime', 'templates']);
const maxBackendLines = 400;
const temporaryOversizeAllowlist = new Set([
  'apps/backend/agent-server/src/runtime/briefings/runtime-tech-briefing-localize.ts',
  'apps/backend/agent-server/src/runtime/briefings/runtime-tech-briefing-ranking.ts',
  'apps/backend/agent-server/src/runtime/briefings/runtime-tech-briefing-sources.ts',
  'apps/backend/agent-server/src/runtime/briefings/runtime-tech-briefing-storage.ts',
  'apps/backend/agent-server/src/runtime/briefings/runtime-tech-briefing.service.ts',
  'apps/backend/agent-server/src/runtime/centers/runtime-centers-query.service.ts',
  'apps/backend/agent-server/src/runtime/helpers/runtime-governance-store.ts',
  'apps/backend/agent-server/src/runtime/runtime.service.ts',
  'apps/backend/agent-server/test/chat/chat-capability-intents.service.spec.ts',
  'apps/backend/agent-server/test/runtime/briefings/runtime-tech-briefing.service.test.ts',
  'apps/backend/agent-server/test/runtime/centers/runtime-centers-governance.service.extra.spec.ts',
  'apps/backend/agent-server/test/runtime/centers/runtime-centers-query.service.spec.ts',
  'apps/backend/agent-server/test/runtime/core/runtime-provider-factories.test.ts'
]);
const backendScopedPrefixes = [
  'apps/backend/agent-server/src/',
  'apps/backend/agent-server/test/',
  'apps/worker/src/',
  'apps/worker/test/'
];

function fail(message) {
  console.error(`[backend:check] ${message}`);
  process.exit(1);
}

function getStagedFiles() {
  const result = spawnSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR'], {
    cwd: rootDir,
    encoding: 'utf8',
    shell: process.platform === 'win32'
  });

  if (result.status !== 0) {
    fail('failed to read staged files');
  }

  return result.stdout
    .split(/\r?\n/)
    .map(item => item.trim())
    .filter(Boolean)
    .filter(file => backendScopedPrefixes.some(prefix => file.startsWith(prefix)));
}

function countLines(filePath) {
  return fs.readFileSync(filePath, 'utf8').split(/\r?\n/).length;
}

function ensureFileLength(files) {
  const oversize = files
    .filter(file => file.endsWith('.ts') || file.endsWith('.tsx'))
    .filter(file => fs.existsSync(path.join(rootDir, file)))
    .map(file => ({
      file,
      lines: countLines(path.join(rootDir, file))
    }))
    .filter(item => item.lines > maxBackendLines && !temporaryOversizeAllowlist.has(item.file));

  if (oversize.length > 0) {
    fail(
      `backend source files must stay within ${maxBackendLines} lines:\n${oversize
        .map(item => `- ${item.file} (${item.lines} lines)`)
        .join('\n')}`
    );
  }
}

function getTouchedModuleDirs(files) {
  return [
    ...new Set(
      files
        .map(file => file.replace(/^apps\/backend\/agent-server\/src\//, ''))
        .filter(file => file.includes('/'))
        .map(file => file.split('/')[0])
        .filter(Boolean)
    )
  ];
}

function ensureModuleLayout(moduleDirName) {
  if (legacyModuleDirs.has(moduleDirName)) {
    return;
  }

  const moduleDir = path.join(backendRoot, moduleDirName);
  if (!fs.existsSync(moduleDir) || !fs.statSync(moduleDir).isDirectory()) {
    return;
  }

  const requiredFiles = [`${moduleDirName}.module.ts`, `${moduleDirName}.controller.ts`, `${moduleDirName}.service.ts`];

  const missing = requiredFiles.filter(file => !fs.existsSync(path.join(moduleDir, file)));
  const hasServiceTestFile =
    fs.existsSync(path.join(moduleDir, `${moduleDirName}.service.spec.ts`)) ||
    fs.existsSync(path.join(moduleDir, `${moduleDirName}.service.test.ts`)) ||
    fs.existsSync(path.join(backendTestRoot, moduleDirName, `${moduleDirName}.service.spec.ts`)) ||
    fs.existsSync(path.join(backendTestRoot, moduleDirName, `${moduleDirName}.service.test.ts`));
  if (!hasServiceTestFile) {
    missing.push(`${moduleDirName}.service.spec.ts`);
  }
  if (missing.length > 0) {
    fail(
      `backend module "${moduleDirName}" must include required files:\n${missing
        .map(file => `- apps/backend/agent-server/src/${moduleDirName}/${file}`)
        .join('\n')}`
    );
  }

  const invalidEntries = fs
    .readdirSync(moduleDir, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .filter(name => !allowedModuleSubdirs.has(name));

  if (invalidEntries.length > 0) {
    fail(
      `backend module "${moduleDirName}" contains unsupported subdirectories:\n${invalidEntries
        .map(name => `- apps/backend/agent-server/src/${moduleDirName}/${name}`)
        .join('\n')}\nAllowed subdirectories: dto/, entities/, interfaces/`
    );
  }
}

function main() {
  const stagedFiles = getStagedFiles();
  if (stagedFiles.length === 0) {
    console.log('[backend:check] no staged backend or backend-test files');
    return;
  }

  ensureFileLength(stagedFiles);
  for (const moduleDir of getTouchedModuleDirs(stagedFiles)) {
    ensureModuleLayout(moduleDir);
  }

  console.log('[backend:check] backend structure OK');
}

main();
