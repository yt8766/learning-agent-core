import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { buildTurboRunArgs, resolveTurboRuntimeRoot, shouldDisableTurboCache } from '../../../scripts/turbo-runner.js';

describe('turbo runner helpers', () => {
  it('uses the system temp directory by default', () => {
    const runtimeRoot = resolveTurboRuntimeRoot({});

    expect(path.basename(runtimeRoot)).toBe('learning-agent-core-turbo');
  });

  it('disables local turbo cache writes in CI', () => {
    expect(shouldDisableTurboCache({ CI: 'true' })).toBe(true);
    expect(shouldDisableTurboCache({})).toBe(false);
  });

  it('builds turbo args with cache-dir, optional filter, and CI read-only cache mode', () => {
    const env = { CI: 'true' };
    const runtimeRoot = resolveTurboRuntimeRoot(env);
    const { args } = buildTurboRunArgs(['check:docs', 'check:architecture'], {
      env,
      filter: '...[origin/main]'
    });

    expect(args).toContain(`--cache-dir=${path.join(runtimeRoot, 'cache')}`);
    expect(args).toContain('--filter=...[origin/main]');
    expect(args).toContain('--cache=local:r,remote:r');
  });
});
