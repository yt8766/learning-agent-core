import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const backendRoot = path.join(rootDir, 'apps/backend/agent-server/src');
const backendTestRoot = path.join(rootDir, 'apps/backend/agent-server/test');
const allowedModuleSubdirs = new Set(['dto', 'entities', 'interfaces', 'repositories']);
const allowedNestedModuleSubdirs = new Set([
  'controllers',
  'services',
  'dto',
  'entities',
  'interfaces',
  'repositories'
]);
const architectureBoundaryDirs = new Set(['api', 'app', 'domains', 'infrastructure', 'platform', 'shared']);
const legacyModuleDirs = new Set([...architectureBoundaryDirs, 'common', 'cors', 'logger', 'runtime', 'templates']);
const maxBackendLines = 400;
const temporaryOversizeAllowlist = new Set([
  'apps/backend/agent-server/src/runtime/centers/runtime-centers-query.service.ts',
  'apps/backend/agent-server/src/runtime/helpers/runtime-governance-store.ts',
  'apps/backend/agent-server/src/runtime/runtime.service.ts',
  'apps/backend/agent-server/src/domains/agent-gateway/management/cli-proxy-management-client.ts',
  'apps/backend/agent-server/src/domains/agent-gateway/management/memory-agent-gateway-management-client.ts',
  'apps/backend/agent-server/test/agent-gateway/agent-gateway-management.controller.spec.ts',
  'apps/backend/agent-server/test/agent-gateway/cli-proxy-management-client.helpers.spec.ts',
  'apps/backend/agent-server/test/agent-gateway/memory-agent-gateway-management-client.branches.spec.ts',
  'apps/backend/agent-server/test/agent-gateway/postgres-agent-gateway-repository-extended.spec.ts',
  'apps/backend/agent-server/test/agent-gateway/provider-runtime.executor.spec.ts',
  'apps/backend/agent-server/test/chat/chat-capability-intents.service.spec.ts',
  'apps/backend/agent-server/test/chat/chat-response-steps.adapter.spec.ts',
  'apps/backend/agent-server/test/agent-tools/agent-tools.service.spec.ts',
  'apps/backend/agent-server/test/knowledge-domain/knowledge-rag-sdk.providers.spec.ts',
  'apps/backend/agent-server/test/knowledge/knowledge-controller-extended.spec.ts',
  'apps/backend/agent-server/test/knowledge/knowledge-postgres-mappers.spec.ts',
  'apps/backend/agent-server/test/knowledge/knowledge-postgres.repository.spec.ts',
  'apps/backend/agent-server/test/knowledge/knowledge-projections.controller.spec.ts',
  'apps/backend/agent-server/test/knowledge/knowledge-rag-sdk-providers.spec.ts',
  'apps/backend/agent-server/test/knowledge/knowledge-trace.service.extended.spec.ts',
  'apps/backend/agent-server/test/logger/platform-console-http-measurement.spec.ts',
  'apps/backend/agent-server/test/runtime/actions/runtime-skill-install-actions.branches.spec.ts',
  'apps/backend/agent-server/test/runtime/centers/runtime-centers-governance.service.extra.spec.ts',
  'apps/backend/agent-server/test/runtime/centers/runtime-centers-query.service.spec.ts',
  'apps/backend/agent-server/test/runtime/centers/runtime-centers-query.service.workspace.test.ts',
  'apps/backend/agent-server/test/runtime/core/runtime-provider-factories.test.ts',
  'apps/backend/agent-server/test/runtime/domain/tasks/runtime-task-audit.spec.ts',
  'apps/backend/agent-server/test/runtime/skills/local-skill-search.spec.ts',
  'apps/backend/agent-server/test/runtime/skills/runtime-skill-install.service.test.ts',
  'apps/backend/agent-server/test/sandbox/sandbox.service.spec.ts'
]);
const backendScopedPrefixes = ['apps/backend/agent-server/src/', 'apps/backend/agent-server/test/'];

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
        .map(file => {
          const segments = file.split('/');
          if (segments[0] === 'modules' && segments[1]) {
            return segments[1];
          }
          return segments[0];
        })
        .filter(Boolean)
    )
  ];
}

function ensureModuleLayout(moduleDirName) {
  if (legacyModuleDirs.has(moduleDirName)) {
    return;
  }

  const moduleDir = path.join(backendRoot, moduleDirName);
  const nestedModuleDir = path.join(backendRoot, 'modules', moduleDirName);
  if (!fs.existsSync(moduleDir) || !fs.statSync(moduleDir).isDirectory()) {
    return;
  }

  const nestedControllerPath = path.join(nestedModuleDir, 'controllers', `${moduleDirName}.controller.ts`);
  const nestedServicePath = path.join(nestedModuleDir, 'services', `${moduleDirName}.service.ts`);
  const usesNestedLayout = fs.existsSync(nestedControllerPath) || fs.existsSync(nestedServicePath);
  const requiredFiles = usesNestedLayout
    ? [`${moduleDirName}.module.ts`]
    : [`${moduleDirName}.module.ts`, `${moduleDirName}.controller.ts`, `${moduleDirName}.service.ts`];

  const missing = requiredFiles.filter(file => !fs.existsSync(path.join(moduleDir, file)));
  if (usesNestedLayout) {
    if (!fs.existsSync(nestedControllerPath)) {
      missing.push(`modules/${moduleDirName}/controllers/${moduleDirName}.controller.ts`);
    }
    if (!fs.existsSync(nestedServicePath)) {
      missing.push(`modules/${moduleDirName}/services/${moduleDirName}.service.ts`);
    }
  }
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
        .map(file =>
          file.startsWith('modules/')
            ? `- apps/backend/agent-server/src/${file}`
            : `- apps/backend/agent-server/src/${moduleDirName}/${file}`
        )
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
        .join('\n')}\nAllowed subdirectories: dto/, entities/, interfaces/, repositories/`
    );
  }

  if (!usesNestedLayout || !fs.existsSync(nestedModuleDir) || !fs.statSync(nestedModuleDir).isDirectory()) {
    return;
  }

  const invalidNestedEntries = fs
    .readdirSync(nestedModuleDir, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .filter(name => !allowedNestedModuleSubdirs.has(name));

  if (invalidNestedEntries.length > 0) {
    fail(
      `backend nested module "${moduleDirName}" contains unsupported subdirectories:\n${invalidNestedEntries
        .map(name => `- apps/backend/agent-server/src/modules/${moduleDirName}/${name}`)
        .join('\n')}\nAllowed subdirectories: controllers/, services/, dto/, entities/, interfaces/, repositories/`
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
