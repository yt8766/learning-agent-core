import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

const WORKER_SOURCE_ROOT = join(process.cwd(), 'apps/worker/src');
const SOURCE_FILE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx']);
const FORBIDDEN_PATTERNS = [
  /@nestjs\/common/,
  /RuntimeService/,
  /runtime-centers/i,
  /controller/i,
  /createOfficialRuntimeAgentDependencies/,
  /createOfficialAgentRegistry/
];

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

describe('worker boundary', () => {
  it('keeps worker code focused on platform runtime consumption instead of backend host logic', async () => {
    const files = await collectSourceFiles(WORKER_SOURCE_ROOT);
    const violations: string[] = [];

    for (const file of files) {
      const content = await readFile(file, 'utf8');
      if (FORBIDDEN_PATTERNS.some(pattern => pattern.test(content))) {
        violations.push(relative(process.cwd(), file));
      }
    }

    expect(violations).toEqual([]);
  });
});
