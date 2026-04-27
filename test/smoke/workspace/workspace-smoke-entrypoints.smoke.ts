import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const smokeRoot = path.join(repoRoot, 'test', 'smoke');
const requiredSmokeLanes = ['apps', 'backend', 'packages', 'workspace'] as const;
const supportLanes = ['fixtures', 'helpers'] as const;

describe('workspace smoke entrypoints smoke', () => {
  it('keeps the root smoke script wired to the workspace smoke host', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8')) as {
      scripts?: Record<string, string>;
    };

    expect(manifest.scripts?.['test:workspace:smoke']).toBe('vitest run --config vitest.config.js test/smoke');
    expect(manifest.scripts?.verify).toContain('pnpm test:workspace:smoke');
  });

  it('keeps every workspace smoke lane backed by at least one smoke file', () => {
    for (const lane of requiredSmokeLanes) {
      const laneDir = path.join(smokeRoot, lane);
      const smokeFiles = fs
        .readdirSync(laneDir)
        .filter(fileName => fileName.endsWith('.smoke.ts') || fileName.endsWith('.smoke.tsx'));

      expect(smokeFiles, `test/smoke/${lane} should contain a workspace smoke file`).not.toHaveLength(0);
    }
  });

  it('keeps smoke files discoverable by lane and suffix', () => {
    const allowedLanes = new Set<string>([...requiredSmokeLanes, ...supportLanes]);
    const topLevelEntries = fs
      .readdirSync(smokeRoot, { withFileTypes: true })
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name);

    expect(topLevelEntries.every(entry => allowedLanes.has(entry))).toBe(true);

    for (const filePath of listFiles(smokeRoot)) {
      const relativePath = path.relative(smokeRoot, filePath);
      if (relativePath.endsWith('.gitkeep')) {
        continue;
      }

      expect(relativePath, 'workspace smoke files must use *.smoke.ts or *.smoke.tsx').toMatch(/\.smoke\.tsx?$/);
    }
  });
});

function listFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const nextPath = path.join(dir, entry.name);
    return entry.isDirectory() ? listFiles(nextPath) : [nextPath];
  });
}
