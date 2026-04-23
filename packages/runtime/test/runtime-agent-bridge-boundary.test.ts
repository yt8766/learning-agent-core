import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

const DIRECT_AGENT_IMPORT_PATTERN = /@agent\/agents-(supervisor|coder|reviewer|data-report)/;

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

describe('runtime agent bridge boundary', () => {
  it('keeps runtime source free of direct @agent/agents-* imports', async () => {
    const srcRoot = join(process.cwd(), 'packages', 'runtime', 'src');
    const files = await collectTsFiles(srcRoot);
    const violations: string[] = [];

    for (const file of files) {
      const content = await readFile(file, 'utf8');
      if (!DIRECT_AGENT_IMPORT_PATTERN.test(content)) {
        continue;
      }
      violations.push(relative(srcRoot, file));
    }

    expect(violations).toEqual([]);
  });

  it('keeps legacy pre-bridge wrapper files removed so bridges remain the only internal adapter host', () => {
    expect(existsSync(new URL('../src/runtime/agent-bridges/coder-runtime-bridge.ts', import.meta.url))).toBe(false);
    expect(existsSync(new URL('../src/runtime/agent-bridges/data-report-runtime-bridge.ts', import.meta.url))).toBe(
      false
    );
    expect(existsSync(new URL('../src/runtime/agent-bridges/reviewer-runtime-bridge.ts', import.meta.url))).toBe(false);
    expect(existsSync(new URL('../src/runtime/agent-bridges/supervisor-runtime-bridge.ts', import.meta.url))).toBe(
      false
    );
  });
});
