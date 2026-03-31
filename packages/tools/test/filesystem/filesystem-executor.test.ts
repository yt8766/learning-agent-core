import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';
import { ActionIntent } from '@agent/shared';

import { executeFilesystemTool } from '../../src/filesystem/filesystem-executor';

describe('executeFilesystemTool', () => {
  const originalCwd = process.cwd();

  afterEach(() => {
    process.chdir(originalCwd);
  });

  it('patches a workspace file', async () => {
    const root = join(process.cwd(), 'tmp', `filesystem-patch-${Date.now()}`);
    const targetFile = join(root, 'src', 'demo.ts');
    await mkdir(join(root, 'src'), { recursive: true });
    await writeFile(targetFile, 'const value = "before";\n');

    process.chdir(root);
    const result = await executeFilesystemTool({
      taskId: 'task-patch',
      toolName: 'patch_local_file',
      intent: ActionIntent.WRITE_FILE,
      requestedBy: 'agent',
      input: {
        path: 'src/demo.ts',
        search: '"before"',
        replace: '"after"'
      }
    });

    expect(result).toBeDefined();
    expect(await readFile(targetFile, 'utf8')).toContain('"after"');
  });

  it('searches in files and returns line-level matches', async () => {
    const root = join(process.cwd(), 'tmp', `filesystem-search-${Date.now()}`);
    await mkdir(join(root, 'src'), { recursive: true });
    await writeFile(join(root, 'src', 'a.ts'), 'export const featureFlag = true;\n');
    await writeFile(join(root, 'src', 'b.ts'), 'const nothing = false;\n');

    process.chdir(root);
    const result = await executeFilesystemTool({
      taskId: 'task-search',
      toolName: 'search_in_files',
      intent: ActionIntent.READ_FILE,
      requestedBy: 'agent',
      input: {
        query: 'featureFlag',
        basePath: 'src'
      }
    });

    expect(result?.rawOutput).toEqual(
      expect.objectContaining({
        matches: [expect.objectContaining({ path: expect.stringContaining('src/a.ts'), line: 1 })]
      })
    );
  });

  it('moves and copies files inside the workspace', async () => {
    const root = join(process.cwd(), 'tmp', `filesystem-move-copy-${Date.now()}`);
    await mkdir(join(root, 'src'), { recursive: true });
    await writeFile(join(root, 'src', 'input.txt'), 'hello');

    process.chdir(root);
    await executeFilesystemTool({
      taskId: 'task-copy',
      toolName: 'copy_local_file',
      intent: ActionIntent.WRITE_FILE,
      requestedBy: 'agent',
      input: {
        fromPath: 'src/input.txt',
        toPath: 'src/copy.txt'
      }
    });
    await executeFilesystemTool({
      taskId: 'task-move',
      toolName: 'move_local_file',
      intent: ActionIntent.WRITE_FILE,
      requestedBy: 'agent',
      input: {
        fromPath: 'src/copy.txt',
        toPath: 'src/moved.txt'
      }
    });

    await expect(stat(join(root, 'src', 'moved.txt'))).resolves.toBeDefined();
  });
});
