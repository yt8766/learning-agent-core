import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';
import { ActionIntent } from '@agent/shared';

import { LocalSandboxExecutor } from './sandbox-executor';

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
});
