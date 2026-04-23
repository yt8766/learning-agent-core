import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  collectDemoProjects,
  collectWorkspaceProjects,
  detectDemoLayers,
  summarizeDemoCoverage,
  validatePackageDemoCoverage
} from '../../../scripts/run-package-demos.js';

async function writeWorkspaceFile(rootDir, relativePath, content) {
  const targetPath = path.join(rootDir, relativePath);
  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(targetPath, content, 'utf8');
}

describe('run-package-demos script', () => {
  const tempDirs = [];

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })));
  });

  it('collects workspace package projects in sorted order', async () => {
    const rootDir = await mkdtemp(path.join(tmpdir(), 'package-demos-'));
    tempDirs.push(rootDir);

    await writeWorkspaceFile(rootDir, 'packages/zeta/package.json', JSON.stringify({ name: '@agent/zeta' }));
    await writeWorkspaceFile(rootDir, 'packages/alpha/package.json', JSON.stringify({ name: '@agent/alpha' }));

    expect(collectWorkspaceProjects(rootDir, 'packages').map(entry => entry.projectPath)).toEqual([
      'packages/alpha',
      'packages/zeta'
    ]);
  });

  it('only collects projects that still expose a demo directory', async () => {
    const rootDir = await mkdtemp(path.join(tmpdir(), 'package-demos-'));
    tempDirs.push(rootDir);

    await writeWorkspaceFile(rootDir, 'packages/alpha/package.json', JSON.stringify({ name: '@agent/alpha' }));
    await writeWorkspaceFile(rootDir, 'packages/alpha/demo/smoke.ts', 'console.log("alpha");');
    await writeWorkspaceFile(rootDir, 'packages/beta/package.json', JSON.stringify({ name: '@agent/beta' }));

    expect(collectDemoProjects(rootDir, 'packages')).toEqual(['packages/alpha']);
  });

  it('flags packages that are missing a demo directory or demo script', async () => {
    const rootDir = await mkdtemp(path.join(tmpdir(), 'package-demos-'));
    tempDirs.push(rootDir);

    await writeWorkspaceFile(
      rootDir,
      'packages/alpha/package.json',
      JSON.stringify({
        name: '@agent/alpha',
        scripts: {
          demo: 'node --import tsx demo/smoke.ts'
        }
      })
    );
    await writeWorkspaceFile(rootDir, 'packages/alpha/demo/smoke.ts', 'console.log("alpha");');
    await writeWorkspaceFile(
      rootDir,
      'packages/beta/package.json',
      JSON.stringify({
        name: '@agent/beta',
        scripts: {}
      })
    );
    await writeWorkspaceFile(rootDir, 'packages/beta/demo/smoke.ts', 'console.log("beta");');
    await writeWorkspaceFile(rootDir, 'packages/gamma/package.json', JSON.stringify({ name: '@agent/gamma' }));

    expect(validatePackageDemoCoverage(rootDir)).toEqual([
      'packages/beta: missing demo script',
      'packages/gamma: missing demo directory',
      'packages/gamma: missing demo/smoke.ts',
      'packages/gamma: missing demo script'
    ]);
  });

  it('detects demo layering and summarizes package coverage by layer', async () => {
    const rootDir = await mkdtemp(path.join(tmpdir(), 'package-demos-'));
    tempDirs.push(rootDir);

    await writeWorkspaceFile(
      rootDir,
      'packages/alpha/package.json',
      JSON.stringify({
        name: '@agent/alpha',
        scripts: {
          demo: 'node --import tsx demo/smoke.ts'
        }
      })
    );
    await writeWorkspaceFile(rootDir, 'packages/alpha/demo/smoke.ts', 'console.log("alpha");');
    await writeWorkspaceFile(rootDir, 'packages/alpha/demo/contract.ts', 'console.log("alpha-contract");');
    await writeWorkspaceFile(
      rootDir,
      'packages/beta/package.json',
      JSON.stringify({
        name: '@agent/beta',
        scripts: {
          demo: 'node --import tsx demo/smoke.ts'
        }
      })
    );
    await writeWorkspaceFile(rootDir, 'packages/beta/demo/smoke.ts', 'console.log("beta");');
    await writeWorkspaceFile(rootDir, 'packages/beta/demo/flow.ts', 'console.log("beta-flow");');

    expect(detectDemoLayers(rootDir, 'packages/alpha')).toEqual({
      hasSmoke: true,
      hasContract: true,
      hasFlow: false
    });
    expect(summarizeDemoCoverage(rootDir)).toEqual([
      {
        projectPath: 'packages/alpha',
        hasSmoke: true,
        hasContract: true,
        hasFlow: false
      },
      {
        projectPath: 'packages/beta',
        hasSmoke: true,
        hasContract: false,
        hasFlow: true
      }
    ]);
  });
});
