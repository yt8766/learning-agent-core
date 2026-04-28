import { readdir, readFile } from 'node:fs/promises';
import { basename, join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

const FORBIDDEN_RUNTIME_IMPORT_PATTERNS = [
  /packages\/runtime\/src/,
  /runtime\/agent-bridges/,
  new RegExp(String.raw`from ['"]@agent\/${['agent', 'kit'].join('-')}(?:\/[^'"]+)?['"]`)
];

const EXPECTED_RUNTIME_IMPORTS_BY_FILE = new Map([
  ['agent-runtime-context.ts', '@agent/runtime'],
  ['temporal-context.ts', '@agent/runtime'],
  ['hubu-search-ministry.ts', '@agent/runtime'],
  ['hubu-search-task-map.ts', '@agent/runtime'],
  ['hubu-web-search.ts', '@agent/runtime'],
  ['hubu-memory-search.ts', '@agent/runtime']
]);

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

describe('@agent/agents-supervisor shared agent foundation boundary', () => {
  it('depends on shared agent foundations only through @agent/runtime root or published subpaths', async () => {
    const srcRoot = join(process.cwd(), 'agents', 'supervisor', 'src');
    const files = await collectTsFiles(srcRoot);
    const violations: string[] = [];

    for (const file of files) {
      const content = await readFile(file, 'utf8');
      const runtimeImports = [...content.matchAll(/from ['"](@agent\/runtime(?:\/[^'"]+)?)['"]/g)].map(
        match => match[1]
      );
      const expectedRuntimeImport = EXPECTED_RUNTIME_IMPORTS_BY_FILE.get(basename(file));

      if (expectedRuntimeImport && !runtimeImports.includes(expectedRuntimeImport)) {
        violations.push(`${relative(srcRoot, file)} -> missing ${expectedRuntimeImport} import`);
      }

      if (FORBIDDEN_RUNTIME_IMPORT_PATTERNS.some(pattern => pattern.test(content))) {
        violations.push(relative(srcRoot, file));
      }
    }

    expect(violations).toEqual([]);
  });
});
