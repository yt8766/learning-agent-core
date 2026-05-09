import { readFile } from 'node:fs/promises';
import { basename, join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

import { listFiles } from './support/file-list';

const cwd = process.cwd();
const packageRoot = basename(cwd) === 'knowledge' ? cwd : join(cwd, 'packages/knowledge');
const sdkSourceExtensions = ['.ts', '.tsx', '.mts', '.cts'];
const workspaceAgentImportPattern = /\bfrom\s+['"]@agent\/|(?:\bimport\s*(?:\(\s*)?|\brequire\s*\(\s*)['"]@agent\//;

function isSdkSourceFile(file: string): boolean {
  return sdkSourceExtensions.some(extension => file.endsWith(extension));
}

function importsWorkspaceAgentPackage(source: string): boolean {
  return workspaceAgentImportPattern.test(source);
}

describe('@agent/knowledge package boundary', () => {
  it('does not depend on workspace @agent packages so it can be published as a standalone SDK', async () => {
    const manifest = JSON.parse(await readFile(join(packageRoot, 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
      peerDependencies?: Record<string, string>;
      optionalDependencies?: Record<string, string>;
    };
    const dependencyNames = Object.keys({
      ...manifest.dependencies,
      ...manifest.devDependencies,
      ...manifest.peerDependencies,
      ...manifest.optionalDependencies
    });

    expect(dependencyNames.filter(name => name.startsWith('@agent/'))).toEqual([]);
  });

  it('does not import workspace @agent packages from SDK source files', async () => {
    const sourceFiles = await listFiles(join(packageRoot, 'src'), isSdkSourceFile);
    const offenders: string[] = [];

    for (const file of sourceFiles) {
      const source = await readFile(file, 'utf8');
      if (importsWorkspaceAgentPackage(source)) {
        offenders.push(relative(packageRoot, file));
      }
    }

    expect(offenders).toEqual([]);
  });
});
