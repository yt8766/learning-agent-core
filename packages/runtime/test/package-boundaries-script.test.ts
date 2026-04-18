import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { findBoundaryViolations } from '../../../scripts/check-package-boundaries.js';

async function writeWorkspaceFile(rootDir: string, relativePath: string, content: string) {
  const targetPath = path.join(rootDir, relativePath);
  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(targetPath, content, 'utf8');
}

describe('check-package-boundaries script', () => {
  const tempDirs: string[] = [];
  const coreSubpathImport = '@agent/core/contracts/execution';
  const runtimeSubpathImport = '@agent/runtime/streaming-execution';

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })));
  });

  it('blocks workspace src imports and @agent subpaths from app code', async () => {
    const rootDir = await mkdtemp(path.join(tmpdir(), 'package-boundaries-'));
    tempDirs.push(rootDir);

    await writeWorkspaceFile(
      rootDir,
      'apps/frontend/agent-chat/src/example.ts',
      [
        "import foo from '../../../packages/runtime/src/index.ts';",
        "import bar from '../../../agents/supervisor/src/index.ts';",
        `import baz from '${runtimeSubpathImport}';`
      ].join('\n')
    );

    const violations = findBoundaryViolations(rootDir);

    expect(violations).toEqual([
      'apps/frontend/agent-chat/src/example.ts imports workspace source path "../../../packages/runtime/src/index.ts" from app code',
      'apps/frontend/agent-chat/src/example.ts imports workspace source path "../../../agents/supervisor/src/index.ts" from app code',
      'apps/frontend/agent-chat/src/example.ts imports package subpath "@agent/runtime/streaming-execution" from app code'
    ]);
  });

  it('allows app code to depend on @agent package roots', async () => {
    const rootDir = await mkdtemp(path.join(tmpdir(), 'package-boundaries-'));
    tempDirs.push(rootDir);

    await writeWorkspaceFile(
      rootDir,
      'apps/backend/agent-server/src/example.ts',
      [
        "import { RuntimeTaskService } from '@agent/runtime';",
        "import { TaskRecordSchema } from '@agent/core';",
        "import { createRuntimeProviderFactory } from '@agent/adapters';"
      ].join('\n')
    );

    expect(findBoundaryViolations(rootDir)).toEqual([]);
  });

  it('blocks subpath imports from runtime and agent test hosts that should consume package roots only', async () => {
    const rootDir = await mkdtemp(path.join(tmpdir(), 'package-boundaries-'));
    tempDirs.push(rootDir);

    await writeWorkspaceFile(
      rootDir,
      'packages/runtime/test/example.test.ts',
      `import { createExecutionContext } from '${coreSubpathImport}';`
    );
    await writeWorkspaceFile(
      rootDir,
      'agents/supervisor/test/example.test.ts',
      `import { executeLater } from '${runtimeSubpathImport}';`
    );

    expect(findBoundaryViolations(rootDir)).toEqual([
      'packages/runtime/test/example.test.ts imports subpath entry "@agent/core/contracts/execution" where the package root entry should be used',
      'agents/supervisor/test/example.test.ts imports subpath entry "@agent/runtime/streaming-execution" where the package root entry should be used'
    ]);
  });
});
