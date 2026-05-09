import { access } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(__dirname, '../../../..');

describe('legacy agent-server knowledge module removal', () => {
  it('does not keep the old fixture-backed src/knowledge module', async () => {
    await expect(access(path.join(repoRoot, 'apps/backend/agent-server/src/knowledge'))).rejects.toMatchObject({
      code: 'ENOENT'
    });
  });
});
