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
  const templatesSubpathImport = '@agent/templates/registries/scaffold-template-registry';

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

  it('blocks subpath imports from additional package and app hosts that should consume package roots only', async () => {
    const rootDir = await mkdtemp(path.join(tmpdir(), 'package-boundaries-'));
    tempDirs.push(rootDir);

    await writeWorkspaceFile(
      rootDir,
      'packages/report-kit/test/example.test.ts',
      `import { listScaffoldTemplates } from '${templatesSubpathImport}';`
    );
    await writeWorkspaceFile(
      rootDir,
      'apps/worker/src/example.ts',
      `import { listScaffoldTemplates } from '${templatesSubpathImport}';`
    );

    expect(findBoundaryViolations(rootDir)).toEqual([
      'packages/report-kit/test/example.test.ts imports subpath entry "@agent/templates/registries/scaffold-template-registry" where the package root entry should be used',
      'apps/worker/src/example.ts imports package subpath "@agent/templates/registries/scaffold-template-registry" from app code'
    ]);
  });

  it('blocks business package dependencies from the core contract package manifest', async () => {
    const rootDir = await mkdtemp(path.join(tmpdir(), 'package-boundaries-'));
    tempDirs.push(rootDir);

    await writeWorkspaceFile(
      rootDir,
      'packages/core/package.json',
      JSON.stringify({
        dependencies: {
          '@agent/report-kit': 'workspace:*',
          zod: '^4.3.6'
        }
      })
    );

    expect(findBoundaryViolations(rootDir)).toEqual([
      'packages/core/package.json depends on business package "@agent/report-kit"; core may only depend on zod and pure contract foundations'
    ]);
  });

  it('blocks application code and manifests from depending on official agent packages directly', async () => {
    const rootDir = await mkdtemp(path.join(tmpdir(), 'package-boundaries-'));
    tempDirs.push(rootDir);

    await writeWorkspaceFile(
      rootDir,
      'apps/backend/agent-server/src/example.ts',
      [
        "import { listWorkflowPresets } from '@agent/agents-supervisor';",
        "import { executeIntelRun } from '@agent/agents-intel-engine';"
      ].join('\n')
    );
    await writeWorkspaceFile(
      rootDir,
      'apps/backend/agent-server/package.json',
      JSON.stringify({
        dependencies: {
          '@agent/agents-intel-engine': 'workspace:*',
          '@agent/agents-supervisor': 'workspace:*',
          '@agent/platform-runtime': 'workspace:*'
        }
      })
    );

    expect(findBoundaryViolations(rootDir)).toEqual([
      'apps/backend/agent-server/package.json depends on official agent package "@agent/agents-intel-engine"; app packages should depend on @agent/platform-runtime for official assembly',
      'apps/backend/agent-server/package.json depends on official agent package "@agent/agents-supervisor"; app packages should depend on @agent/platform-runtime for official assembly',
      'apps/backend/agent-server/src/example.ts imports official agent package "@agent/agents-supervisor" from app code; use @agent/platform-runtime instead',
      'apps/backend/agent-server/src/example.ts imports official agent package "@agent/agents-intel-engine" from app code; use @agent/platform-runtime instead'
    ]);
  });

  it('blocks app code from importing platform-runtime assembly helpers directly', async () => {
    const rootDir = await mkdtemp(path.join(tmpdir(), 'package-boundaries-'));
    tempDirs.push(rootDir);

    await writeWorkspaceFile(
      rootDir,
      'apps/backend/agent-server/src/example.ts',
      "import { resolveWorkflowPreset, listWorkflowPresets, createDefaultPlatformRuntime } from '@agent/platform-runtime';"
    );

    expect(findBoundaryViolations(rootDir)).toEqual([
      'apps/backend/agent-server/src/example.ts imports "@agent/platform-runtime" directly from backend app code; backend should route official platform-runtime access through runtime/core facades',
      'apps/backend/agent-server/src/example.ts imports platform-runtime assembly helper(s) "resolveWorkflowPreset, listWorkflowPresets" from app code; apps should consume the platform facade instead of inlining official runtime assembly'
    ]);
  });

  it('blocks backend app code from importing platform-runtime directly outside runtime core facades', async () => {
    const rootDir = await mkdtemp(path.join(tmpdir(), 'package-boundaries-'));
    tempDirs.push(rootDir);

    await writeWorkspaceFile(
      rootDir,
      'apps/backend/agent-server/src/chat/chat.service.ts',
      "import type { DataReportJsonGenerateResult } from '@agent/platform-runtime';"
    );
    await writeWorkspaceFile(
      rootDir,
      'apps/backend/agent-server/src/runtime/core/runtime.host.ts',
      "import { createDefaultPlatformRuntime } from '@agent/platform-runtime';"
    );

    expect(findBoundaryViolations(rootDir)).toEqual([
      'apps/backend/agent-server/src/chat/chat.service.ts imports "@agent/platform-runtime" directly from backend app code; backend should route official platform-runtime access through runtime/core facades'
    ]);
  });

  it('blocks runtime code and manifest from depending on official agent packages directly', async () => {
    const rootDir = await mkdtemp(path.join(tmpdir(), 'package-boundaries-'));
    tempDirs.push(rootDir);

    await writeWorkspaceFile(
      rootDir,
      'packages/runtime/src/example.ts',
      "import { listWorkflowPresets } from '@agent/agents-supervisor';"
    );
    await writeWorkspaceFile(
      rootDir,
      'packages/runtime/package.json',
      JSON.stringify({
        dependencies: {
          '@agent/agents-supervisor': 'workspace:*',
          '@agent/core': 'workspace:*'
        }
      })
    );

    expect(findBoundaryViolations(rootDir)).toEqual([
      'packages/runtime/package.json depends on official agent package "@agent/agents-supervisor"; runtime must depend on abstract agent contracts instead of concrete official agents',
      'packages/runtime/src/example.ts imports official agent package "@agent/agents-supervisor" from runtime code; runtime must depend on abstract agent contracts instead'
    ]);
  });

  it('blocks supervisor package code and manifest from depending on specialist official agents directly', async () => {
    const rootDir = await mkdtemp(path.join(tmpdir(), 'package-boundaries-'));
    tempDirs.push(rootDir);

    await writeWorkspaceFile(
      rootDir,
      'agents/supervisor/src/example.ts',
      "import { GongbuCodeMinistry } from '@agent/agents-coder';"
    );
    await writeWorkspaceFile(
      rootDir,
      'agents/supervisor/package.json',
      JSON.stringify({
        dependencies: {
          '@agent/agents-coder': 'workspace:*',
          '@agent/core': 'workspace:*'
        }
      })
    );

    expect(findBoundaryViolations(rootDir)).toEqual([
      'agents/supervisor/package.json depends on specialist official agent package "@agent/agents-coder"; supervisor must dispatch through contracts instead of depending on sibling specialist agents directly',
      'agents/supervisor/src/example.ts imports specialist official agent package "@agent/agents-coder" from supervisor code; supervisor must dispatch through contracts instead of depending on sibling specialist agents directly'
    ]);
  });
});
