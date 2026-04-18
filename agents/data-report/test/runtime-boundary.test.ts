import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

const FORBIDDEN_RUNTIME_IMPORT_PATTERNS = [/packages\/runtime\/src/, /@agent\/runtime\//, /runtime\/agent-bridges/];

async function collectTsFiles(rootDir: string): Promise<string[]> {
  const entries = await readdir(rootDir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async entry => {
      const fullPath = join(rootDir, entry.name);
      if (entry.isDirectory()) {
        return collectTsFiles(fullPath);
      }
      if (entry.isFile() && fullPath.endsWith('.ts')) {
        return [fullPath];
      }
      return [];
    })
  );

  return files.flat();
}

describe('@agent/agents-data-report runtime boundary', () => {
  it('depends on runtime only through the @agent/runtime root entry', async () => {
    const srcRoot = join(process.cwd(), 'agents', 'data-report', 'src');
    const files = await collectTsFiles(srcRoot);
    const violations: string[] = [];

    for (const file of files) {
      const content = await readFile(file, 'utf8');
      if (content.includes("from '@agent/runtime'") || content.includes('from "@agent/runtime"')) {
        const sanitized = content.replaceAll("from '@agent/runtime'", '').replaceAll('from "@agent/runtime"', '');
        if (FORBIDDEN_RUNTIME_IMPORT_PATTERNS.some(pattern => pattern.test(sanitized))) {
          violations.push(relative(srcRoot, file));
        }
        continue;
      }

      if (FORBIDDEN_RUNTIME_IMPORT_PATTERNS.some(pattern => pattern.test(content))) {
        violations.push(relative(srcRoot, file));
      }
    }

    expect(violations).toEqual([]);
  });
});
