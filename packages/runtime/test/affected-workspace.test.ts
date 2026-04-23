import { describe, expect, it } from 'vitest';

import {
  DEFAULT_AFFECTED_BASE_REF,
  buildTurboAffectedFilter,
  resolveAffectedBaseRef,
  resolveAffectedLintFiles
} from '../../../scripts/affected-workspace.js';
import {
  WORKSPACE_INTEGRATION_TESTS,
  resolveAffectedWorkspaceIntegrationFiles
} from '../../../scripts/run-workspace-integration-affected.js';

describe('affected workspace helpers', () => {
  it('uses origin/main when no custom base ref is configured', () => {
    expect(resolveAffectedBaseRef({})).toBe(DEFAULT_AFFECTED_BASE_REF);
    expect(buildTurboAffectedFilter(DEFAULT_AFFECTED_BASE_REF)).toBe('...[origin/main]');
  });

  it('uses VERIFY_BASE_REF when provided', () => {
    expect(resolveAffectedBaseRef({ VERIFY_BASE_REF: 'origin/release' })).toBe('origin/release');
    expect(buildTurboAffectedFilter('origin/release')).toBe('...[origin/release]');
  });

  it('falls back to full lint when shared lint config changes', () => {
    expect(resolveAffectedLintFiles(['eslint.config.js'], 'eslint')).toEqual({
      mode: 'all',
      files: []
    });

    expect(resolveAffectedLintFiles(['prettier.config.js'], 'prettier')).toEqual({
      mode: 'all',
      files: []
    });
  });

  it('filters changed files per lint tool', () => {
    expect(
      resolveAffectedLintFiles(['README.md', 'scripts/affected-workspace.js', 'missing-file.ts'], 'eslint')
    ).toEqual({
      mode: 'targeted',
      files: ['scripts/affected-workspace.js']
    });

    expect(
      resolveAffectedLintFiles(['README.md', 'scripts/affected-workspace.js', 'missing-file.ts'], 'prettier')
    ).toEqual({
      mode: 'targeted',
      files: ['README.md', 'scripts/affected-workspace.js']
    });
  });

  it('maps core contract changes to workspace integration contract consumers', () => {
    expect(resolveAffectedWorkspaceIntegrationFiles(['packages/core/src/index.ts'])).toEqual({
      mode: 'targeted',
      files: [
        WORKSPACE_INTEGRATION_TESTS.frontendBackendSse,
        WORKSPACE_INTEGRATION_TESTS.coreRuntimeContract,
        WORKSPACE_INTEGRATION_TESTS.approvalRecover,
        WORKSPACE_INTEGRATION_TESTS.runtimeMainChain
      ].sort((left, right) => left.localeCompare(right))
    });
  });

  it('maps platform-runtime changes to platform assembly and runtime main chain tests', () => {
    expect(resolveAffectedWorkspaceIntegrationFiles(['packages/platform-runtime/src/index.ts'])).toEqual({
      mode: 'targeted',
      files: [WORKSPACE_INTEGRATION_TESTS.platformRuntimeAssembly, WORKSPACE_INTEGRATION_TESTS.runtimeMainChain].sort(
        (left, right) => left.localeCompare(right)
      )
    });
  });

  it('runs all workspace integration tests when shared integration fixtures change', () => {
    expect(resolveAffectedWorkspaceIntegrationFiles(['test/integration/helpers/create-test-runtime.ts'])).toEqual({
      mode: 'all',
      files: Object.values(WORKSPACE_INTEGRATION_TESTS).sort((left, right) => left.localeCompare(right))
    });
  });

  it('runs only the changed workspace integration test when a test file changes', () => {
    expect(
      resolveAffectedWorkspaceIntegrationFiles(['test/integration/runtime/approval-recover-contract.int-spec.ts'])
    ).toEqual({
      mode: 'targeted',
      files: [WORKSPACE_INTEGRATION_TESTS.approvalRecover]
    });
  });

  it('skips workspace integration when only workspace smoke changes', () => {
    expect(resolveAffectedWorkspaceIntegrationFiles(['test/smoke/backend/backend-startup.smoke.ts'])).toEqual({
      mode: 'none',
      files: []
    });
  });
});
