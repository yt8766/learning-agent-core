import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => ({
  tasksStateFilePath: ''
}));

vi.mock('@agent/config', () => ({
  loadSettings: () => ({
    tasksStateFilePath: mocked.tasksStateFilePath
  })
}));

describe('FileRuntimeStateRepository', () => {
  let tempDir = '';

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'agent-runtime-state-'));
    mocked.tasksStateFilePath = join(tempDir, 'runtime', 'tasks-state.json');
    vi.resetModules();
  });

  afterEach(async () => {
    vi.clearAllMocks();
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('在文件不存在时返回空快照', async () => {
    const { FileRuntimeStateRepository } = await import('./runtime-state-repository');
    const repository = new FileRuntimeStateRepository();

    await expect(repository.load()).resolves.toEqual({
      tasks: [],
      learningJobs: [],
      pendingExecutions: [],
      chatSessions: [],
      chatMessages: [],
      chatEvents: [],
      chatCheckpoints: [],
      usageHistory: [],
      evalHistory: [],
      usageAudit: []
    });
  });

  it('保存后可以完整读回快照', async () => {
    const { FileRuntimeStateRepository } = await import('./runtime-state-repository');
    const repository = new FileRuntimeStateRepository();
    const snapshot = {
      tasks: [
        {
          id: 'task-1',
          goal: 'demo',
          status: 'completed',
          trace: [],
          approvals: [],
          agentStates: [],
          messages: [],
          createdAt: '2026-03-22T00:00:00.000Z',
          updatedAt: '2026-03-22T00:00:00.000Z'
        }
      ],
      learningJobs: [],
      pendingExecutions: [],
      chatSessions: [],
      chatMessages: [],
      chatEvents: [],
      chatCheckpoints: [],
      usageHistory: [],
      evalHistory: [],
      usageAudit: []
    };

    await repository.save(snapshot as any);

    await expect(repository.load()).resolves.toEqual(snapshot);
  });
});
