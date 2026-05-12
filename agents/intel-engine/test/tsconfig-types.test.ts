import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

describe('@agent/agents-intel-engine type build config', () => {
  it('declares workspace path aliases for declaration builds', async () => {
    const raw = await readFile(join(__dirname, '../tsconfig.types.json'), 'utf8');
    const config = JSON.parse(raw) as {
      compilerOptions?: Record<string, unknown>;
    };

    expect(config.compilerOptions?.baseUrl).toBe('.');
    expect(config.compilerOptions?.paths).toEqual({
      '@agent/core': ['../../packages/core/build/types/index.d.ts']
    });
  });
});
