import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

describe('@agent/agents-intel-engine type build config', () => {
  it('inherits workspace path aliases for declaration builds', async () => {
    const raw = await readFile(new URL('../tsconfig.types.json', import.meta.url), 'utf8');
    const config = JSON.parse(raw) as {
      compilerOptions?: Record<string, unknown>;
    };

    expect(config.compilerOptions?.baseUrl).toBeUndefined();
    expect(config.compilerOptions?.paths).toBeUndefined();
  });
});
