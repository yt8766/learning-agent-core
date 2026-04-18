import { describe, expect, it } from 'vitest';

import {
  DEFAULT_AFFECTED_BASE_REF,
  buildTurboAffectedFilter,
  resolveAffectedBaseRef,
  resolveAffectedLintFiles
} from '../../../scripts/affected-workspace.js';

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
    expect(resolveAffectedLintFiles(['docs/test.md', 'apps/frontend/agent-chat/src/page.tsx'], 'eslint')).toEqual({
      mode: 'targeted',
      files: ['apps/frontend/agent-chat/src/page.tsx']
    });

    expect(resolveAffectedLintFiles(['docs/test.md', 'apps/frontend/agent-chat/src/page.tsx'], 'prettier')).toEqual({
      mode: 'targeted',
      files: ['docs/test.md', 'apps/frontend/agent-chat/src/page.tsx']
    });
  });
});
