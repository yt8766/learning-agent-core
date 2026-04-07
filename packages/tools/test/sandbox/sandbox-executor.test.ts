import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';
import { ActionIntent } from '@agent/shared';

import { LocalSandboxExecutor } from '../../src/sandbox/sandbox-executor';

describe('LocalSandboxExecutor find-skills', () => {
  const originalCwd = process.cwd();

  afterEach(() => {
    process.chdir(originalCwd);
  });

  it('discovers installed, local, and cached remote skills from the workspace', async () => {
    const root = join(process.cwd(), 'tmp', `sandbox-find-skills-${Date.now()}`);
    await mkdir(join(root, 'skills', 'repo-audit'), { recursive: true });
    await mkdir(join(root, 'data', 'skills', 'remote-sources', 'bundled-marketplace'), { recursive: true });
    await mkdir(join(root, 'data', 'skills', 'installed', 'bundled-marketplace', 'repo_review_companion', '0.1.0'), {
      recursive: true
    });

    await writeFile(
      join(root, 'skills', 'repo-audit', 'SKILL.md'),
      '# Repo Audit\n\nAudit repository structure and review risks.'
    );
    await writeFile(
      join(root, 'data', 'skills', 'remote-sources', 'bundled-marketplace', 'index.json'),
      JSON.stringify({
        manifests: [
          {
            id: 'repo_review_companion',
            name: 'Repo Review Companion',
            description: 'Remote repo review helper',
            summary: 'Review repository structure and pull requests.',
            version: '0.1.0',
            sourceId: 'bundled-marketplace'
          }
        ]
      })
    );
    await writeFile(
      join(
        root,
        'data',
        'skills',
        'installed',
        'bundled-marketplace',
        'repo_review_companion',
        '0.1.0',
        'repo_review_companion@0.1.0.json'
      ),
      JSON.stringify({
        manifest: {
          id: 'repo_review_companion',
          name: 'Repo Review Companion',
          description: 'Installed repo review helper',
          summary: 'Installed repo review helper',
          version: '0.1.0',
          sourceId: 'bundled-marketplace'
        }
      })
    );

    process.chdir(root);
    const executor = new LocalSandboxExecutor();
    const result = await executor.execute({
      taskId: 'task-find-skills',
      toolName: 'find-skills',
      intent: ActionIntent.READ_FILE,
      requestedBy: 'agent',
      input: {
        goal: 'need a repo review skill',
        limit: 5
      }
    });

    expect(result.ok).toBe(true);
    expect(result.rawOutput).toEqual(
      expect.objectContaining({
        goal: 'need a repo review skill',
        suggestions: expect.arrayContaining([
          expect.objectContaining({
            id: 'repo_review_companion',
            kind: 'installed'
          }),
          expect.objectContaining({
            id: 'repo-audit',
            kind: 'local-manifest'
          }),
          expect.objectContaining({
            id: 'repo_review_companion',
            kind: 'remote-manifest'
          })
        ])
      })
    );
  });

  it('deletes a workspace file with delete_local_file', async () => {
    const root = join(process.cwd(), 'tmp', `sandbox-delete-file-${Date.now()}`);
    const targetFile = join(root, 'data', 'tmp.txt');
    await mkdir(join(root, 'data'), { recursive: true });
    await writeFile(targetFile, 'to-delete');

    process.chdir(root);
    const executor = new LocalSandboxExecutor();
    const result = await executor.execute({
      taskId: 'task-delete-file',
      toolName: 'delete_local_file',
      intent: ActionIntent.DELETE_FILE,
      requestedBy: 'agent',
      input: {
        path: 'data/tmp.txt'
      }
    });

    expect(result.ok).toBe(true);
    await expect(stat(targetFile)).rejects.toThrow();
  });

  it('creates a local runtime schedule with schedule_task', async () => {
    const root = join(process.cwd(), 'tmp', `sandbox-schedule-task-${Date.now()}`);
    await mkdir(root, { recursive: true });

    process.chdir(root);
    const executor = new LocalSandboxExecutor();
    const result = await executor.execute({
      taskId: 'task-schedule',
      toolName: 'schedule_task',
      intent: ActionIntent.SCHEDULE_TASK,
      requestedBy: 'agent',
      input: {
        name: 'Daily Lark Digest',
        prompt: 'Send a lark digest',
        schedule: 'weekday 09:00',
        status: 'ACTIVE',
        cwd: '.'
      }
    });

    expect(result.ok).toBe(true);
    const output = result.rawOutput as { path: string };
    const created = JSON.parse(await readFile(output.path, 'utf8')) as { name: string; schedule: string };
    expect(created.name).toBe('Daily Lark Digest');
    expect(created.schedule).toBe('weekday 09:00');
  });
});
