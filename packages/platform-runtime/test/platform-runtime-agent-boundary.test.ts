import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

function readWorkspaceFile(path: string): string {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

describe('platform-runtime agent package boundary', () => {
  it('does not depend on concrete agents packages', () => {
    const packageJson = JSON.parse(readWorkspaceFile('packages/platform-runtime/package.json')) as {
      dependencies?: Record<string, string>;
    };

    expect(Object.keys(packageJson.dependencies ?? {}).filter(name => name.startsWith('@agent/agents-'))).toEqual([]);
  });

  it('keeps concrete agents imports out of platform-runtime source', () => {
    const grepInput = [
      readWorkspaceFile('packages/platform-runtime/src/index.ts'),
      readWorkspaceFile('packages/platform-runtime/src/registries/index.ts'),
      readWorkspaceFile('packages/platform-runtime/src/runtime/create-platform-runtime.ts'),
      readWorkspaceFile('packages/platform-runtime/src/runtime/create-default-platform-runtime.ts'),
      readWorkspaceFile('packages/platform-runtime/src/contracts/platform-runtime-facade.ts')
    ].join('\n');

    expect(grepInput).not.toContain('@agent/agents-');
  });
});
