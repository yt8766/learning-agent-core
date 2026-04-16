import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';
import { ActionIntent } from '@agent/shared';

import { executeRuntimeGovernanceTool } from '../../src/runtime-governance/runtime-governance-executor';
import { cleanupTempWorkspaces, createTempWorkspace } from '../test-utils/temp-workspace';

describe('executeRuntimeGovernanceTool', () => {
  const originalCwd = process.cwd();
  const tempWorkspaces: string[] = [];

  afterEach(async () => {
    process.chdir(originalCwd);
    await cleanupTempWorkspaces(tempWorkspaces.splice(0));
  });

  it('archives threads and lists runtime artifacts', async () => {
    const root = await createTempWorkspace('runtime-governance');
    tempWorkspaces.push(root);
    await mkdir(join(root, 'data', 'browser-replays', 'session-1'), { recursive: true });
    process.chdir(root);

    await executeRuntimeGovernanceTool({
      taskId: 'task-archive',
      toolName: 'archive_thread',
      intent: ActionIntent.WRITE_FILE,
      requestedBy: 'agent',
      input: {
        sessionId: 'session-1',
        reason: 'completed'
      }
    });

    await executeRuntimeGovernanceTool({
      taskId: 'task-recover',
      toolName: 'recover_run',
      intent: ActionIntent.WRITE_FILE,
      requestedBy: 'agent',
      input: {
        runId: 'run-1',
        checkpointId: 'checkpoint-1'
      }
    });

    const listed = await executeRuntimeGovernanceTool({
      taskId: 'task-list',
      toolName: 'list_runtime_artifacts',
      intent: ActionIntent.READ_FILE,
      requestedBy: 'agent',
      input: {
        kind: 'all'
      }
    });

    expect(listed?.rawOutput).toEqual(
      expect.objectContaining({
        archives: [expect.objectContaining({ sessionId: 'session-1' })],
        recoveries: [expect.objectContaining({ runId: 'run-1' })],
        browserReplays: [expect.objectContaining({ name: 'session-1', type: 'directory' })]
      })
    );
  });
});
