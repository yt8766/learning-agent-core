import { existsSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

describe('memory helper host boundary', () => {
  it('keeps helper implementations in the canonical normalization and governance hosts', async () => {
    const normalizationHelpers = (await import(
      new URL('../src/normalization/memory-record-helpers.ts', import.meta.url).href
    )) as {
      buildStructuredSearchResult: unknown;
      normalizeMemoryRecord: unknown;
    };
    const governanceHelpers = (await import(
      new URL('../src/governance/memory-repository-governance.ts', import.meta.url).href
    )) as {
      recordMemoryFeedback: unknown;
      rollbackMemory: unknown;
    };

    expect(typeof normalizationHelpers.normalizeMemoryRecord).toBe('function');
    expect(typeof normalizationHelpers.buildStructuredSearchResult).toBe('function');
    expect(typeof governanceHelpers.recordMemoryFeedback).toBe('function');
    expect(typeof governanceHelpers.rollbackMemory).toBe('function');
  });

  it('removes the legacy package-root helper compat files', () => {
    expect(existsSync(new URL('../src/memory-record-helpers.ts', import.meta.url))).toBe(false);
    expect(existsSync(new URL('../src/memory-repository-governance.ts', import.meta.url))).toBe(false);
  });

  it('removes the internal transition helper wrappers once canonical hosts are wired directly', () => {
    expect(existsSync(new URL('../src/shared/memory-record-helpers.ts', import.meta.url))).toBe(false);
    expect(existsSync(new URL('../src/repositories/memory-repository-governance.ts', import.meta.url))).toBe(false);
  });
});
