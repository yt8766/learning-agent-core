import { mkdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';
import { ActionIntent } from '@agent/core';

import { executeRuntimeGovernanceTool } from '../../src/executors/runtime-governance/runtime-governance-executor';
import { cleanupTempWorkspaces, createTempWorkspace } from '../test-utils/temp-workspace';

describe('executeRuntimeGovernanceTool', () => {
  const originalCwd = process.cwd();
  const tempWorkspaces: string[] = [];

  afterEach(async () => {
    process.chdir(originalCwd);
    await cleanupTempWorkspaces(tempWorkspaces.splice(0));
  });

  it('uses an injected repository for runtime governance artifacts without creating root data/runtime', async () => {
    const root = await createTempWorkspace('runtime-governance');
    tempWorkspaces.push(root);
    await mkdir(join(root, 'artifacts', 'runtime', 'browser-replays', 'session-1'), { recursive: true });
    process.chdir(root);

    await executeRuntimeGovernanceTool(
      {
        taskId: 'task-archive',
        toolName: 'archive_thread',
        intent: ActionIntent.WRITE_FILE,
        requestedBy: 'agent',
        input: {
          sessionId: 'session-1',
          reason: 'completed'
        }
      },
      {
        repository: runtimeRepository
      }
    );

    await executeRuntimeGovernanceTool(
      {
        taskId: 'task-recover',
        toolName: 'recover_run',
        intent: ActionIntent.WRITE_FILE,
        requestedBy: 'agent',
        input: {
          runId: 'run-1',
          checkpointId: 'checkpoint-1'
        }
      },
      {
        repository: runtimeRepository
      }
    );

    const listed = await executeRuntimeGovernanceTool(
      {
        taskId: 'task-list',
        toolName: 'list_runtime_artifacts',
        intent: ActionIntent.READ_FILE,
        requestedBy: 'agent',
        input: {
          kind: 'all'
        }
      },
      {
        repository: runtimeRepository
      }
    );

    await expect(stat(join(root, 'data', 'runtime'))).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(stat(join(root, 'data', 'browser-replays'))).rejects.toMatchObject({ code: 'ENOENT' });
    expect(listed?.rawOutput).toEqual(
      expect.objectContaining({
        archives: [expect.objectContaining({ sessionId: 'session-1' })],
        recoveries: [expect.objectContaining({ runId: 'run-1' })],
        browserReplays: [expect.objectContaining({ name: 'session-1', type: 'directory' })]
      })
    );
  });
});

const runtimeRepository = (() => {
  const archives: Record<string, unknown>[] = [];
  const recoveries: Record<string, unknown>[] = [];
  const cancellations: Record<string, unknown>[] = [];
  return {
    async archiveThread(archive: Record<string, unknown>) {
      archives.push(archive);
    },
    async recordCancellation(cancel: Record<string, unknown>) {
      cancellations.push(cancel);
    },
    async recordRecovery(recovery: Record<string, unknown>) {
      recoveries.push(recovery);
    },
    async listRuntimeArtifacts(kind: string) {
      return {
        kind,
        schedules: [],
        archives: kind === 'all' || kind === 'archives' ? archives : [],
        recoveries: kind === 'all' || kind === 'recoveries' ? recoveries : [],
        cancellations: kind === 'all' || kind === 'cancellations' ? cancellations : []
      };
    }
  };
})();
