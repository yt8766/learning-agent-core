import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const repoRoot = join(import.meta.dirname, '..', '..', '..');

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

describe('knowledge-cli app location', () => {
  it('lives under apps/cli and does not keep the old root apps location', async () => {
    await expect(exists(join(repoRoot, 'apps', 'cli', 'knowledge-cli', 'package.json'))).resolves.toBe(true);
    await expect(exists(join(repoRoot, 'apps', 'knowledge-cli', 'package.json'))).resolves.toBe(false);
  });

  it('keeps pnpm workspace coverage for apps/cli/knowledge-cli', async () => {
    const workspace = await readFile(join(repoRoot, 'pnpm-workspace.yaml'), 'utf8');

    expect(workspace).toContain('apps/*/*');
  });
});
