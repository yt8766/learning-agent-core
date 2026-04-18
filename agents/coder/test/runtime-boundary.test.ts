import { readdir, readFile } from 'node:fs/promises';
import { basename, join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

const FORBIDDEN_RUNTIME_IMPORT_PATTERNS = [
  /packages\/runtime\/src/,
  /runtime\/agent-bridges/,
  /from ['"]@agent\/runtime(?:\/[^'"]+)?['"]/
];

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

describe('@agent/agents-coder shared agent foundation boundary', () => {
  it('depends on shared agent foundations only through the @agent/agent-kit root entry', async () => {
    const srcRoot = join(process.cwd(), 'agents', 'coder', 'src');
    const files = await collectTsFiles(srcRoot);
    const violations: string[] = [];

    for (const file of files) {
      const content = await readFile(file, 'utf8');
      const agentKitImports = [...content.matchAll(/from ['"](@agent\/agent-kit(?:\/[^'"]+)?)['"]/g)].map(
        match => match[1]
      );

      for (const agentKitImport of agentKitImports) {
        if (agentKitImport !== '@agent/agent-kit') {
          violations.push(`${relative(srcRoot, file)} -> ${agentKitImport}`);
        }
      }

      if (basename(file) === 'base-agent.ts' && !agentKitImports.includes('@agent/agent-kit')) {
        violations.push(`${relative(srcRoot, file)} -> missing @agent/agent-kit root import`);
      }

      if (FORBIDDEN_RUNTIME_IMPORT_PATTERNS.some(pattern => pattern.test(content))) {
        violations.push(relative(srcRoot, file));
      }
    }

    expect(violations).toEqual([]);
  });
});
