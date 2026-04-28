import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

describe('@agent/evals contract boundaries', () => {
  it('consumes migrated tool execution contracts from runtime instead of core', () => {
    const source = readFileSync(new URL('../src/regressions/execution-evaluator.ts', import.meta.url), 'utf8');

    expect(source).toContain("from '@agent/runtime'");
    expect(source).not.toMatch(/ToolExecutionResult[\s\S]*from '@agent\/core'/);
  });
});
