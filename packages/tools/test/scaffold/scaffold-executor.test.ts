import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';
import { ActionIntent } from '@agent/shared';

import { LocalSandboxExecutor } from '../../src/sandbox/sandbox-executor';
import { cleanupTempWorkspaces, createTempWorkspace } from '../test-utils/temp-workspace';

describe('LocalSandboxExecutor scaffold tools', () => {
  const originalCwd = process.cwd();
  const tempWorkspaces: string[] = [];

  afterEach(async () => {
    process.chdir(originalCwd);
    await cleanupTempWorkspaces(tempWorkspaces.splice(0));
  });

  it('lists templates and previews a package scaffold without writing files', async () => {
    const root = await createTempWorkspace('sandbox-scaffold-preview');
    tempWorkspaces.push(root);
    const previewTarget = join(root, 'packages', 'preview-toolkit');

    process.chdir(originalCwd);
    const executor = new LocalSandboxExecutor();

    const listed = await executor.execute({
      taskId: 'task-scaffold-list',
      toolName: 'list_scaffold_templates',
      intent: ActionIntent.READ_FILE,
      requestedBy: 'agent',
      input: {
        hostKind: 'package'
      }
    });

    expect(listed.ok).toBe(true);
    expect(listed.rawOutput).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'package-lib', hostKind: 'package' })])
    );

    const previewed = await executor.execute({
      taskId: 'task-scaffold-preview',
      toolName: 'preview_scaffold',
      intent: ActionIntent.READ_FILE,
      requestedBy: 'agent',
      input: {
        hostKind: 'package',
        name: 'preview-toolkit',
        targetRoot: previewTarget
      }
    });

    expect(previewed.ok).toBe(true);
    expect(previewed.outputSummary).toContain('preview-toolkit');
    expect(previewed.rawOutput).toEqual(
      expect.objectContaining({
        hostKind: 'package',
        files: expect.arrayContaining([expect.objectContaining({ path: 'src/schemas/preview-toolkit.schema.ts' })])
      })
    );
    expect(existsSync(previewTarget)).toBe(false);
  });

  it('blocks conflicting writes by default and writes after force=true', async () => {
    const root = await createTempWorkspace('sandbox-scaffold-write');
    tempWorkspaces.push(root);
    const targetRoot = join(root, 'packages', 'write-toolkit');

    await mkdir(targetRoot, { recursive: true });
    await writeFile(join(targetRoot, 'README.md'), '# occupied\n', 'utf8');

    process.chdir(originalCwd);
    const executor = new LocalSandboxExecutor();

    const blocked = await executor.execute({
      taskId: 'task-scaffold-write-blocked',
      toolName: 'write_scaffold',
      intent: ActionIntent.WRITE_FILE,
      requestedBy: 'agent',
      input: {
        hostKind: 'package',
        name: 'write-toolkit',
        targetRoot
      }
    });

    expect(blocked.ok).toBe(true);
    expect(blocked.outputSummary).toContain('not empty');
    expect(blocked.rawOutput).toEqual(
      expect.objectContaining({
        blocked: true,
        inspection: expect.objectContaining({
          canWriteSafely: false,
          targetRoot
        })
      })
    );
    expect(existsSync(join(targetRoot, 'src', 'index.ts'))).toBe(false);

    const written = await executor.execute({
      taskId: 'task-scaffold-write-forced',
      toolName: 'write_scaffold',
      intent: ActionIntent.WRITE_FILE,
      requestedBy: 'agent',
      input: {
        hostKind: 'package',
        name: 'write-toolkit',
        targetRoot,
        force: true
      }
    });

    expect(written.ok).toBe(true);
    expect(written.outputSummary).toContain('Wrote');
    expect(written.rawOutput).toEqual(
      expect.objectContaining({
        targetRoot,
        totalWritten: expect.any(Number)
      })
    );
    expect(existsSync(join(targetRoot, 'src', 'index.ts'))).toBe(true);
  });
});
