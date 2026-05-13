import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';
import { ActionIntent } from '@agent/core';

import { executeFilesystemTool } from '../../../src/executors/filesystem/filesystem-executor';
import { cleanupTempWorkspaces, createTempWorkspace } from '../../test-utils/temp-workspace';

describe('executeFilesystemTool extended coverage', () => {
  const originalCwd = process.cwd();
  const tempWorkspaces: string[] = [];

  afterEach(async () => {
    process.chdir(originalCwd);
    await cleanupTempWorkspaces(tempWorkspaces.splice(0));
  });

  function makeRequest(toolName: string, input: Record<string, unknown> = {}) {
    return {
      taskId: 'task-1',
      toolName,
      intent: ActionIntent.READ_FILE,
      requestedBy: 'agent' as const,
      input
    };
  }

  it('returns undefined for unknown tool name', async () => {
    const result = await executeFilesystemTool(makeRequest('unknown_tool'));
    expect(result).toBeUndefined();
  });

  it('write_local_file creates directories and writes content', async () => {
    const root = await createTempWorkspace('fs-write');
    tempWorkspaces.push(root);
    process.chdir(root);

    const result = await executeFilesystemTool(
      makeRequest('write_local_file', { path: 'deep/nested/file.txt', content: 'hello world' })
    );

    expect(result).toBeDefined();
    expect(await readFile(join(root, 'deep/nested/file.txt'), 'utf8')).toBe('hello world');
  });

  it('write_local_file uses JSON.stringify when content is not string', async () => {
    const root = await createTempWorkspace('fs-write-json');
    tempWorkspaces.push(root);
    process.chdir(root);

    const result = await executeFilesystemTool(
      makeRequest('write_local_file', { path: 'output.txt', nested: { data: true } })
    );

    expect(result).toBeDefined();
    const content = await readFile(join(root, 'output.txt'), 'utf8');
    expect(content).toContain('nested');
  });

  it('delete_local_file removes file', async () => {
    const root = await createTempWorkspace('fs-delete');
    tempWorkspaces.push(root);
    await mkdir(join(root, 'src'), { recursive: true });
    await writeFile(join(root, 'src', 'del.txt'), 'delete me');
    process.chdir(root);

    const result = await executeFilesystemTool(makeRequest('delete_local_file', { path: 'src/del.txt' }));

    expect(result?.outputSummary).toContain('文件');
  });

  it('delete_local_file removes directory with recursive flag', async () => {
    const root = await createTempWorkspace('fs-delete-dir');
    tempWorkspaces.push(root);
    await mkdir(join(root, 'dir'), { recursive: true });
    await writeFile(join(root, 'dir', 'a.txt'), 'a');
    process.chdir(root);

    const result = await executeFilesystemTool(makeRequest('delete_local_file', { path: 'dir', recursive: true }));

    expect(result?.outputSummary).toContain('目录');
  });

  it('patch_local_file throws when search string is empty', async () => {
    const root = await createTempWorkspace('fs-patch-empty');
    tempWorkspaces.push(root);
    await writeFile(join(root, 'file.ts'), 'content');
    process.chdir(root);

    await expect(
      executeFilesystemTool(makeRequest('patch_local_file', { path: 'file.ts', search: '', replace: 'x' }))
    ).rejects.toThrow('non-empty search string');
  });

  it('patch_local_file throws when search not found in file', async () => {
    const root = await createTempWorkspace('fs-patch-notfound');
    tempWorkspaces.push(root);
    await writeFile(join(root, 'file.ts'), 'nothing here');
    process.chdir(root);

    await expect(
      executeFilesystemTool(makeRequest('patch_local_file', { path: 'file.ts', search: 'MISSING', replace: 'x' }))
    ).rejects.toThrow('Search text not found');
  });

  it('patch_local_file with replaceAll replaces all occurrences', async () => {
    const root = await createTempWorkspace('fs-patch-all');
    tempWorkspaces.push(root);
    await writeFile(join(root, 'file.ts'), 'aaa bbb aaa');
    process.chdir(root);

    const result = await executeFilesystemTool(
      makeRequest('patch_local_file', { path: 'file.ts', search: 'aaa', replace: 'ccc', all: true })
    );

    expect(await readFile(join(root, 'file.ts'), 'utf8')).toBe('ccc bbb ccc');
    expect(result?.rawOutput.replacements).toBe(2);
  });

  it('read_json parses JSON file', async () => {
    const root = await createTempWorkspace('fs-read-json');
    tempWorkspaces.push(root);
    await writeFile(join(root, 'data.json'), '{"key":"value"}');
    process.chdir(root);

    const result = await executeFilesystemTool(makeRequest('read_json', { path: 'data.json' }));

    expect(result?.rawOutput.value).toEqual({ key: 'value' });
  });

  it('write_json writes JSON file with spacing', async () => {
    const root = await createTempWorkspace('fs-write-json-file');
    tempWorkspaces.push(root);
    process.chdir(root);

    const result = await executeFilesystemTool(
      makeRequest('write_json', { path: 'out.json', value: { a: 1 }, spacing: 4 })
    );

    const content = await readFile(join(root, 'out.json'), 'utf8');
    expect(content).toContain('    "a"');
    expect(result).toBeDefined();
  });

  it('glob_workspace matches files by pattern', async () => {
    const root = await createTempWorkspace('fs-glob');
    tempWorkspaces.push(root);
    await mkdir(join(root, 'src'), { recursive: true });
    await writeFile(join(root, 'src', 'a.ts'), 'a');
    await writeFile(join(root, 'src', 'b.js'), 'b');
    process.chdir(root);

    const result = await executeFilesystemTool(makeRequest('glob_workspace', { basePath: 'src', pattern: '*.ts' }));

    expect(result?.rawOutput.items.length).toBeGreaterThanOrEqual(1);
  });

  it('search_in_files throws when query is empty', async () => {
    const root = await createTempWorkspace('fs-search-empty');
    tempWorkspaces.push(root);
    process.chdir(root);

    await expect(executeFilesystemTool(makeRequest('search_in_files', { query: '  ' }))).rejects.toThrow(
      'non-empty query'
    );
  });
});
