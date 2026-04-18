import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

const APP_SOURCE_ROOTS = [
  'apps/backend/agent-server/src',
  'apps/frontend/agent-chat/src',
  'apps/frontend/agent-admin/src',
  'apps/worker/src'
] as const;

const SOURCE_FILE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx']);
const FORBIDDEN_IMPORT_PATTERNS = [/packages\/[^'"\n]+\/src/, /agents\/[^'"\n]+\/src/, /@agent\/[^/'"\n]+\/[^'"\n]+/];

async function collectSourceFiles(rootDir: string): Promise<string[]> {
  const entries = await readdir(rootDir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async entry => {
      const fullPath = join(rootDir, entry.name);
      if (entry.isDirectory()) {
        return collectSourceFiles(fullPath);
      }

      const extension = fullPath.slice(fullPath.lastIndexOf('.'));
      if (entry.isFile() && SOURCE_FILE_EXTENSIONS.has(extension)) {
        return [fullPath];
      }

      return [];
    })
  );

  return files.flat();
}

describe('app dependency boundary', () => {
  it('keeps application code on public @agent package roots only', async () => {
    const workspaceRoot = process.cwd();
    const violations: string[] = [];

    for (const sourceRoot of APP_SOURCE_ROOTS) {
      const absoluteRoot = join(workspaceRoot, sourceRoot);
      const files = await collectSourceFiles(absoluteRoot);

      for (const file of files) {
        const content = await readFile(file, 'utf8');
        if (!FORBIDDEN_IMPORT_PATTERNS.some(pattern => pattern.test(content))) {
          continue;
        }

        violations.push(relative(workspaceRoot, file));
      }
    }

    expect(violations).toEqual([]);
  });
});
