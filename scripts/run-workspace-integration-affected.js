import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { readChangedPaths } from './affected-workspace.js';

export const WORKSPACE_INTEGRATION_TESTS = Object.freeze({
  backendChatSse: 'test/integration/backend/chat-sse-controller.int-spec.ts',
  frontendBackendStreamMerge: 'test/integration/frontend-backend/chat-session-stream-merge.int-spec.ts',
  frontendBackendSse: 'test/integration/frontend-backend/sse-payload-contract.int-spec.ts',
  coreRuntimeContract: 'test/integration/packages/core-to-runtime-contract.int-spec.ts',
  platformRuntimeAssembly: 'test/integration/packages/platform-runtime-agent-assembly.int-spec.ts',
  approvalRecover: 'test/integration/runtime/approval-recover-contract.int-spec.ts',
  approvalRecoverStateMachine: 'test/integration/runtime/approval-recover-state-machine.int-spec.ts',
  learningConfirmation: 'test/integration/runtime/learning-confirmation.int-spec.ts',
  runtimeGraphExecution: 'test/integration/runtime/runtime-graph-execution.int-spec.ts',
  runtimeMainChain: 'test/integration/runtime/runtime-main-chain.int-spec.ts'
});

const ALL_WORKSPACE_INTEGRATION_TESTS = Object.freeze(Object.values(WORKSPACE_INTEGRATION_TESTS));

const GLOBAL_WORKSPACE_INTEGRATION_IMPACT_PATHS = new Set([
  'package.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  'vitest.config.js',
  'scripts/affected-workspace.js',
  'scripts/run-workspace-integration-affected.js',
  '.github/workflows/pr-check.yml',
  '.github/workflows/main-check.yml'
]);

const scriptPath = fileURLToPath(import.meta.url);
const scriptDir = path.dirname(scriptPath);
const repoRoot = path.resolve(scriptDir, '..');

export function resolveAffectedWorkspaceIntegrationFiles(changedPaths) {
  const normalizedPaths = [...new Set(changedPaths.map(normalizeRepoPath).filter(Boolean))].sort((left, right) =>
    left.localeCompare(right)
  );

  if (normalizedPaths.length === 0) {
    return {
      mode: 'none',
      files: []
    };
  }

  if (normalizedPaths.some(isGlobalWorkspaceIntegrationImpactPath)) {
    return {
      mode: 'all',
      files: [...ALL_WORKSPACE_INTEGRATION_TESTS]
    };
  }

  if (normalizedPaths.some(isSharedWorkspaceIntegrationSupportPath)) {
    return {
      mode: 'all',
      files: [...ALL_WORKSPACE_INTEGRATION_TESTS]
    };
  }

  const files = new Set();

  for (const changedPath of normalizedPaths) {
    addDirectWorkspaceIntegrationTest(changedPath, files);
    addMappedWorkspaceIntegrationTests(changedPath, files);
  }

  return {
    mode: files.size === 0 ? 'none' : 'targeted',
    files: [...files].sort((left, right) => left.localeCompare(right))
  };
}

function addDirectWorkspaceIntegrationTest(changedPath, files) {
  if (changedPath.startsWith('test/integration/') && changedPath.endsWith('.int-spec.ts')) {
    files.add(changedPath);
    return;
  }
}

function isSharedWorkspaceIntegrationSupportPath(changedPath) {
  return (
    changedPath.startsWith('test/integration/helpers/') ||
    changedPath.startsWith('test/integration/fixtures/') ||
    changedPath.startsWith('test/shared/')
  );
}

function addMappedWorkspaceIntegrationTests(changedPath, files) {
  if (changedPath.startsWith('packages/core/')) {
    files.add(WORKSPACE_INTEGRATION_TESTS.coreRuntimeContract);
    files.add(WORKSPACE_INTEGRATION_TESTS.runtimeMainChain);
    files.add(WORKSPACE_INTEGRATION_TESTS.runtimeGraphExecution);
    files.add(WORKSPACE_INTEGRATION_TESTS.approvalRecover);
    files.add(WORKSPACE_INTEGRATION_TESTS.approvalRecoverStateMachine);
    files.add(WORKSPACE_INTEGRATION_TESTS.learningConfirmation);
    files.add(WORKSPACE_INTEGRATION_TESTS.frontendBackendSse);
    files.add(WORKSPACE_INTEGRATION_TESTS.frontendBackendStreamMerge);
    return;
  }

  if (changedPath.startsWith('packages/runtime/')) {
    files.add(WORKSPACE_INTEGRATION_TESTS.coreRuntimeContract);
    files.add(WORKSPACE_INTEGRATION_TESTS.runtimeMainChain);
    files.add(WORKSPACE_INTEGRATION_TESTS.runtimeGraphExecution);
    files.add(WORKSPACE_INTEGRATION_TESTS.approvalRecover);
    files.add(WORKSPACE_INTEGRATION_TESTS.approvalRecoverStateMachine);
    files.add(WORKSPACE_INTEGRATION_TESTS.learningConfirmation);
    return;
  }

  if (changedPath.startsWith('packages/platform-runtime/')) {
    files.add(WORKSPACE_INTEGRATION_TESTS.platformRuntimeAssembly);
    files.add(WORKSPACE_INTEGRATION_TESTS.runtimeMainChain);
    files.add(WORKSPACE_INTEGRATION_TESTS.runtimeGraphExecution);
    return;
  }

  if (changedPath.startsWith('agents/')) {
    files.add(WORKSPACE_INTEGRATION_TESTS.platformRuntimeAssembly);
    files.add(WORKSPACE_INTEGRATION_TESTS.runtimeMainChain);
    files.add(WORKSPACE_INTEGRATION_TESTS.runtimeGraphExecution);
    return;
  }

  if (changedPath.startsWith('apps/backend/')) {
    files.add(WORKSPACE_INTEGRATION_TESTS.backendChatSse);
    files.add(WORKSPACE_INTEGRATION_TESTS.frontendBackendSse);
    files.add(WORKSPACE_INTEGRATION_TESTS.frontendBackendStreamMerge);
    files.add(WORKSPACE_INTEGRATION_TESTS.approvalRecover);
    files.add(WORKSPACE_INTEGRATION_TESTS.approvalRecoverStateMachine);
    files.add(WORKSPACE_INTEGRATION_TESTS.learningConfirmation);
    return;
  }

  if (changedPath.startsWith('apps/frontend/')) {
    files.add(WORKSPACE_INTEGRATION_TESTS.frontendBackendSse);
    files.add(WORKSPACE_INTEGRATION_TESTS.frontendBackendStreamMerge);
  }
}

function isGlobalWorkspaceIntegrationImpactPath(relativePath) {
  return GLOBAL_WORKSPACE_INTEGRATION_IMPACT_PATHS.has(relativePath);
}

function normalizeRepoPath(filePath) {
  return filePath.replace(/\\/g, '/');
}

function runCli() {
  const changed = readChangedPaths({ repoRoot });

  if (!changed.hasReadableSignal) {
    console.warn(
      '[workspace-integration] unable to resolve affected files from git; running all workspace integration'
    );
    return runVitest(ALL_WORKSPACE_INTEGRATION_TESTS);
  }

  const affected = resolveAffectedWorkspaceIntegrationFiles(changed.paths);

  if (affected.mode === 'none') {
    console.log('[workspace-integration] no affected workspace integration tests found');
    return 0;
  }

  console.log(`[workspace-integration] ${affected.mode} scope -> ${affected.files.length} files`);
  return runVitest(affected.files);
}

function runVitest(files) {
  const result = spawnSync('pnpm', ['exec', 'vitest', 'run', '--config', 'vitest.config.js', ...files], {
    cwd: repoRoot,
    stdio: 'inherit'
  });

  return typeof result.status === 'number' ? result.status : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  process.exit(runCli());
}
